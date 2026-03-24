package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

var googleOauthConfig *oauth2.Config

func init() {
	// This will be configured dynamically when endpoints are accessed
}

type registerRequest struct {
	AccountNumber int     `json:"account_number"`
	Name          string  `json:"name"`
	Password      string  `json:"password"`
	Balance       float64 `json:"initial_balance"`
}

func handleRegister(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return map[string]string{"error": "invalid payload"}, http.StatusBadRequest
	}

	// check unique account number
	if _, ok := getAccountByNumber(req.AccountNumber); ok {
		return map[string]string{"error": "account number in use"}, http.StatusBadRequest
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return map[string]string{"error": "could not hash password"}, http.StatusInternalServerError
	}

	id, err := createAccount(req.AccountNumber, req.Name, string(hash), req.Balance)
	if err != nil || id == 0 {
		return map[string]string{"error": "could not create account"}, http.StatusInternalServerError
	}
	return map[string]interface{}{"message": "account created", "id": id}, http.StatusCreated
}

type loginRequest struct {
	AccountNumber int    `json:"account_number"`
	Password      string `json:"password"`
}

func handleLogin(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return map[string]string{"error": "invalid payload"}, http.StatusBadRequest
	}

	acc, ok := getAccountByNumber(req.AccountNumber)
	if !ok {
		return map[string]string{"error": "invalid credentials"}, http.StatusUnauthorized
	}
	id := acc.ID
	if err := bcrypt.CompareHashAndPassword([]byte(acc.PasswordHash), []byte(req.Password)); err != nil {
		return map[string]string{"error": "invalid credentials"}, http.StatusUnauthorized
	}

	// create session token
	token := uuid.NewString()
	hashTok := hashToken(token)
	expires := time.Now().Add(7 * 24 * time.Hour)
	if err := createSession(hashTok, id, expires); err != nil {
		return map[string]string{"error": "could not create session"}, http.StatusInternalServerError
	}

	http.SetCookie(w, &http.Cookie{Name: "session_token", Value: token, Path: "/", HttpOnly: true, Expires: expires})
	return map[string]string{"message": "logged in"}, http.StatusOK
}

func handleRefresh(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	cookie, err := r.Cookie("session_token")
	if err != nil || cookie.Value == "" {
		return map[string]string{"error": "no session"}, http.StatusUnauthorized
	}
	h := hashToken(cookie.Value)
	accountID, expiresStr, ok := getSessionAccount(h)
	if !ok {
		return map[string]string{"error": "invalid session"}, http.StatusUnauthorized
	}
	expires, _ := time.Parse(time.RFC3339, expiresStr)
	if time.Now().After(expires) {
		_ = deleteSession(h)
		return map[string]string{"error": "session expired"}, http.StatusUnauthorized
	}

	// rotate
	newTok := uuid.NewString()
	newHash := hashToken(newTok)
	newExpires := time.Now().Add(7 * 24 * time.Hour)
	// delete old and create new
	_ = deleteSession(h)
	if err := createSession(newHash, accountID, newExpires); err != nil {
		return map[string]string{"error": "could not rotate"}, http.StatusInternalServerError
	}
	http.SetCookie(w, &http.Cookie{Name: "session_token", Value: newTok, Path: "/", HttpOnly: true, Expires: newExpires})
	return map[string]string{"message": "rotated"}, http.StatusOK
}

func handleLogout(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	cookie, err := r.Cookie("session_token")
	if err == nil && cookie.Value != "" {
		_ = deleteSession(hashToken(cookie.Value))
		http.SetCookie(w, &http.Cookie{Name: "session_token", Value: "", Path: "/", HttpOnly: true, Expires: time.Now().Add(-1 * time.Hour)})
	}
	return map[string]string{"message": "logged out"}, http.StatusOK
}

func handleMe(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	val := r.Context().Value("account_id")
	if val == nil {
		return map[string]string{"error": "unauthorized"}, http.StatusUnauthorized
	}
	accountID := val.(int64)
	if a, ok := getAccountByID(accountID); ok {
		return map[string]interface{}{
			"account": map[string]interface{}{
				"id":             a.ID,
				"account_number": a.AccountNumber,
				"name":           a.Name,
				"balance":        a.Balance,
			},
		}, http.StatusOK
	}
	return map[string]string{"error": "could not fetch account"}, http.StatusInternalServerError
}

// Change Password
type changePasswordReq struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

func handleChangePassword(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	var req changePasswordReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return map[string]string{"error": "invalid payload"}, http.StatusBadRequest
	}
	if req.OldPassword == "" || req.NewPassword == "" {
		return map[string]string{"error": "both old and new password required"}, http.StatusBadRequest
	}
	if len(req.NewPassword) < 4 {
		return map[string]string{"error": "new password must be at least 4 characters"}, http.StatusBadRequest
	}

	val := r.Context().Value("account_id")
	accountID := val.(int64)

	acc, ok := getAccountByID(accountID)
	if !ok {
		return map[string]string{"error": "account not found"}, http.StatusNotFound
	}

	if err := bcrypt.CompareHashAndPassword([]byte(acc.PasswordHash), []byte(req.OldPassword)); err != nil {
		return map[string]string{"error": "current password is incorrect"}, http.StatusUnauthorized
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return map[string]string{"error": "could not hash password"}, http.StatusInternalServerError
	}

	store.mu.Lock()
	acc.PasswordHash = string(hash)
	store.mu.Unlock()
	saveStore()

	return map[string]string{"message": "password changed successfully"}, http.StatusOK
}

// Update Profile
type updateProfileReq struct {
	Name string `json:"name"`
}

func handleUpdateProfile(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	var req updateProfileReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return map[string]string{"error": "invalid payload"}, http.StatusBadRequest
	}
	if req.Name == "" {
		return map[string]string{"error": "name cannot be empty"}, http.StatusBadRequest
	}

	val := r.Context().Value("account_id")
	accountID := val.(int64)

	store.mu.Lock()
	acc, ok := store.Accounts[accountID]
	if !ok {
		store.mu.Unlock()
		return map[string]string{"error": "account not found"}, http.StatusNotFound
	}
	acc.Name = req.Name
	store.mu.Unlock()
	saveStore()

	return map[string]string{"message": "profile updated", "name": req.Name}, http.StatusOK
}

// OAuth - handle Google Sign-in flow
func handleOAuthGoogle(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
	redirectURL := os.Getenv("OAUTH_REDIRECT_URL")

	if clientID == "" || clientSecret == "" {
		http.Redirect(w, r, "/auth.html?oauth=unavailable", http.StatusFound)
		return nil, http.StatusFound
	}

	if redirectURL == "" {
		redirectURL = "http://localhost:8080/api/oauth/callback"
	}

	googleOauthConfig = &oauth2.Config{
		RedirectURL:  redirectURL,
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Scopes:       []string{"https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"},
		Endpoint:     google.Endpoint,
	}

	b := make([]byte, 16)
	rand.Read(b)
	state := base64.URLEncoding.EncodeToString(b)
	// We should technically save this state in a cookie to prevent CSRF, but we'll allow it for now
	http.SetCookie(w, &http.Cookie{Name: "oauthstate", Value: state, Path: "/", HttpOnly: true, Expires: time.Now().Add(10 * time.Minute)})

	url := googleOauthConfig.AuthCodeURL(state)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
	return nil, http.StatusFound
}

func handleOAuthCallback(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	cookie, err := r.Cookie("oauthstate")
	if err != nil || r.FormValue("state") != cookie.Value {
		http.Redirect(w, r, "/auth.html?oauth=error", http.StatusFound)
		return nil, http.StatusFound
	}

	code := r.FormValue("code")
	if code == "" {
		http.Redirect(w, r, "/auth.html?oauth=error", http.StatusFound)
		return nil, http.StatusFound
	}

	token, err := googleOauthConfig.Exchange(r.Context(), code)
	if err != nil {
		http.Redirect(w, r, "/auth.html?oauth=error", http.StatusFound)
		return nil, http.StatusFound
	}

	client := googleOauthConfig.Client(r.Context(), token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		http.Redirect(w, r, "/auth.html?oauth=error", http.StatusFound)
		return nil, http.StatusFound
	}
	defer resp.Body.Close()

	var userInfo struct {
		ID    string `json:"id"`
		Email string `json:"email"`
		Name  string `json:"name"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		http.Redirect(w, r, "/auth.html?oauth=error", http.StatusFound)
		return nil, http.StatusFound
	}

	// We have the google user info! Find or create user.
	// Since SecureVault uses account numbers as primary keys, we will generate a random account number
	// and register them if they don't exist based on their email.
    // For simplicity, we are tying "account_number" to a hash of their google ID or just a random number initialized to their email
	
	// Check if we have an account with the Google ID inside their password field 
	// (a bit of a hack since there is no `email` or `oauth_id` field in the Account struct)
	var accountId int64 = 0
	
	store.mu.Lock()
	for _, acc := range store.Accounts {
		if acc.Name == userInfo.Name || acc.PasswordHash == "GOOGLE:"+userInfo.ID {
			accountId = acc.ID
			break
		}
	}
	store.mu.Unlock()

	if accountId == 0 {
		// Register a new user
		// Generate an account number
		accNum := 100000 + int(time.Now().Unix()%900000)
		id, err := createAccount(accNum, userInfo.Name, "GOOGLE:"+userInfo.ID, 0)
		if err == nil {
			accountId = id
		} else {
            http.Redirect(w, r, "/auth.html?oauth=error", http.StatusFound)
		    return nil, http.StatusFound
        }
	}

	// Log them in by generating a token
	session_token := uuid.NewString()
	hashTok := hashToken(session_token)
	expires := time.Now().Add(7 * 24 * time.Hour)
	if err := createSession(hashTok, accountId, expires); err != nil {
		http.Redirect(w, r, "/auth.html?oauth=error", http.StatusFound)
		return nil, http.StatusFound
	}

	http.SetCookie(w, &http.Cookie{Name: "session_token", Value: session_token, Path: "/", HttpOnly: true, Expires: expires})
	http.Redirect(w, r, "/dashboard.html", http.StatusFound)
	return nil, http.StatusFound
}
