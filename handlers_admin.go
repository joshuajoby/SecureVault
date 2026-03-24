package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

// handleAdminStats returns system-wide statistics
func handleAdminStats(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	stats := getPlatformStats()

	// Anonymous struct example for a simple response
	response := struct {
		Message string                 `json:"message"`
		Data    map[string]interface{} `json:"data"`
	}{
		Message: "Platform statistics retrieved successfully",
		Data:    stats,
	}

	return response, http.StatusOK
}

// handleAdminUsers returns all users with card_count and loan_count
func handleAdminUsers(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	users := getAllUsers()

	var displayUsers []*Account
	if len(users) > 100 {
		displayUsers = users[:100]
	} else {
		displayUsers = users
	}

	store.mu.RLock()
	defer store.mu.RUnlock()

	var safeUsers []interface{}
	for _, u := range displayUsers {
		cardCount := 0
		if _, hasCard := store.Cards[u.ID]; hasCard {
			cardCount = 1
		}
		loanCount := 0
		for _, l := range store.Loans {
			if l.AccountID == u.ID {
				loanCount++
			}
		}
		safeUsers = append(safeUsers, struct {
			ID            int64   `json:"id"`
			AccountNumber int     `json:"account_number"`
			Name          string  `json:"name"`
			Balance       float64 `json:"balance"`
			CardCount     int     `json:"card_count"`
			LoanCount     int     `json:"loan_count"`
		}{
			ID:            u.ID,
			AccountNumber: u.AccountNumber,
			Name:          u.Name,
			Balance:       u.Balance,
			CardCount:     cardCount,
			LoanCount:     loanCount,
		})
	}

	return safeUsers, http.StatusOK
}

// handleAdminDeleteUser deletes a user by ID
func handleAdminDeleteUser(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	if r.Method != http.MethodDelete && r.Method != http.MethodPost {
		return map[string]string{"error": "method not allowed"}, http.StatusMethodNotAllowed
	}

	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		// Try parsing from JSON body if not in query
		var req struct {
			ID int64 `json:"id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil && req.ID != 0 {
			idStr = strconv.FormatInt(req.ID, 10)
		}
	}

	if idStr == "" {
		return map[string]string{"error": "missing id"}, http.StatusBadRequest
	}

	// Conversion: string to int64
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return map[string]string{"error": "invalid id format"}, http.StatusBadRequest
	}

	if err := deleteUser(id); err != nil {
		return map[string]string{"error": "failed to delete user"}, http.StatusInternalServerError
	}

	return map[string]string{"message": "user deleted successfully"}, http.StatusOK
}

// handleAdminUserDetail returns individual user data including all banking modules
func handleAdminUserDetail(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		return map[string]string{"error": "missing id"}, http.StatusBadRequest
	}

	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return map[string]string{"error": "invalid id"}, http.StatusBadRequest
	}

	store.mu.RLock()
	defer store.mu.RUnlock()

	acc, ok := store.Accounts[id]
	if !ok {
		return map[string]string{"error": "user not found"}, http.StatusNotFound
	}

	// Gather transactions
	var txns []map[string]interface{}
	for _, tx := range store.Transactions {
		if tx.AccountID == id {
			txns = append(txns, map[string]interface{}{
				"id":         tx.ID,
				"type":       tx.Type,
				"amount":     tx.Amount,
				"created_at": tx.CreatedAt,
			})
		}
	}

	// Gather card
	var card map[string]interface{} = nil
	if c, ok := store.Cards[id]; ok {
		card = map[string]interface{}{
			"id":          c.ID,
			"card_number": c.CardNumber,
			"expiry":      c.Expiry,
			"cvv":         c.CVV,
			"type":        c.Type,
			"status":      c.Status,
		}
	}

	// Gather loans
	var loans []map[string]interface{}
	for _, l := range store.Loans {
		if l.AccountID == id {
			loans = append(loans, map[string]interface{}{
				"id":            l.ID,
				"amount":        l.Amount,
				"status":        l.Status,
				"interest_rate": l.InterestRate,
			})
		}
	}

	// Gather bills (all: paid + pending)
	var bills []map[string]interface{}
	for _, b := range store.Bills {
		if b.AccountID == id {
			bills = append(bills, map[string]interface{}{
				"id":       b.ID,
				"biller":   b.Biller,
				"amount":   b.Amount,
				"due_date": b.DueDate,
				"status":   b.Status,
			})
		}
	}

	// Gather fixed deposits
	var fds []map[string]interface{}
	for _, fd := range store.FixedDeposits {
		if fd.AccountID == id {
			fds = append(fds, map[string]interface{}{
				"id":       fd.ID,
				"amount":   fd.Amount,
				"interest": fd.Interest,
				"maturity": fd.Maturity,
			})
		}
	}

	// Gather mutual funds
	var mfs []map[string]interface{}
	for _, mf := range store.MutualFunds {
		if mf.AccountID == id {
			mfs = append(mfs, map[string]interface{}{
				"id":        mf.ID,
				"fund_name": mf.FundName,
				"units":     mf.Units,
				"nav":       mf.NAV,
			})
		}
	}

	// Gather SIPs
	var sips []map[string]interface{}
	for _, s := range store.SIPs {
		if s.AccountID == id {
			sips = append(sips, map[string]interface{}{
				"id":        s.ID,
				"fund_name": s.FundName,
				"amount":    s.Amount,
				"frequency": s.Frequency,
				"next_date": s.NextDate,
			})
		}
	}

	// Gather corporate trades
	var trades []map[string]interface{}
	for _, t := range store.CorporateTrades {
		if t.AccountID == id {
			trades = append(trades, map[string]interface{}{
				"id":     t.ID,
				"type":   t.Type,
				"amount": t.Amount,
				"status": t.Status,
			})
		}
	}

	response := map[string]interface{}{
		"user": map[string]interface{}{
			"id":             acc.ID,
			"account_number": acc.AccountNumber,
			"name":           acc.Name,
			"balance":        acc.Balance,
		},
		"transactions": txns,
		"card":         card,
		"loans":        loans,
		"bills":        bills,
		"fds":          fds,
		"mfs":          mfs,
		"sips":         sips,
		"trades":       trades,
	}

	return response, http.StatusOK
}

// ADMIN_PASSWORD is the hardcoded admin access code.
// In production this would come from env vars or a secure vault.
const ADMIN_PASSWORD = "12345"

// handleAdminLogin authenticates admin access using a shared secret code.
// On success it sets the same session cookie so admin pages work.
func handleAdminLogin(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	if r.Method != http.MethodPost {
		return map[string]string{"error": "method not allowed"}, http.StatusMethodNotAllowed
	}

	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return map[string]string{"error": "invalid request"}, http.StatusBadRequest
	}

	if req.Password != ADMIN_PASSWORD {
		return map[string]string{"error": "invalid access code"}, http.StatusUnauthorized
	}

	// Create a temporary session for the first account (admin piggyback)
	// In a real app, admins would have their own account table
	users := getAllUsers()
	var adminAccountID int64 = 1
	if len(users) > 0 {
		adminAccountID = users[0].ID
	} else {
		// No users exist yet — create a system admin account
		adminAccountID = createAdminPlaceholder()
	}

	// Generate session token
	b := make([]byte, 32)
	rand.Read(b)
	token := fmt.Sprintf("%x", b)
	h := sha256.Sum256([]byte(token))
	hs := hex.EncodeToString(h[:])

	expires := time.Now().Add(2 * time.Hour)
	// createSession uses the store's session map with proper locking
	createSession(hs, adminAccountID, expires)

	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Expires:  expires,
	})

	return map[string]string{"message": "admin access granted"}, http.StatusOK
}

// createAdminPlaceholder creates a system admin account if no users exist
func createAdminPlaceholder() int64 {
	store.mu.Lock()
	defer store.mu.Unlock()
	a := &Account{
		ID:            store.NextAccountID,
		AccountNumber: 100000,
		Name:          "System Admin",
		Balance:       0,
	}
	store.NextAccountID++
	store.Accounts[a.ID] = a
	store.ByAccountNumber[a.AccountNumber] = a.ID
	go saveStore()
	return a.ID
}

// --- NEW MODULE ENDPOINTS (APPROVALS) ---

type approveReq struct {
	ID int64 `json:"id"`
}

func handleAdminApproveLoan(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	var req approveReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return map[string]string{"error": "invalid request"}, http.StatusBadRequest
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	var loan *Loan
	for _, l := range store.Loans {
		if l.ID == req.ID {
			loan = l
			break
		}
	}

	if loan == nil {
		return map[string]string{"error": "loan not found"}, http.StatusNotFound
	}

	if loan.Status == "approved" {
		return map[string]string{"error": "loan already approved"}, http.StatusBadRequest
	}

	loan.Status = "approved"

	// Deposit funds into user account upon approval
	if acc, ok := store.Accounts[loan.AccountID]; ok {
		acc.Balance += loan.Amount
		store.NextTransactionID++
		tx := &Transaction{
			ID:        store.NextTransactionID,
			AccountID: loan.AccountID,
			Type:      "loan_deposit",
			Amount:    loan.Amount,
			CreatedAt: time.Now().Format(time.RFC3339),
		}
		store.Transactions = append(store.Transactions, tx)
	}

	saveStore()
	return map[string]string{"message": "loan approved successfully"}, http.StatusOK
}

func handleAdminRejectLoan(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	var req approveReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return map[string]string{"error": "invalid request"}, http.StatusBadRequest
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	var loan *Loan
	for _, l := range store.Loans {
		if l.ID == req.ID {
			loan = l
			break
		}
	}

	if loan == nil {
		return map[string]string{"error": "loan not found"}, http.StatusNotFound
	}
	loan.Status = "rejected"

	saveStore()
	return map[string]string{"message": "loan rejected"}, http.StatusOK
}

func handleAdminApproveCard(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	var req approveReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return map[string]string{"error": "invalid request"}, http.StatusBadRequest
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	var cardToUpdate *Card
	for _, c := range store.Cards {
		if c.ID == req.ID {
			cardToUpdate = c
			break
		}
	}

	if cardToUpdate == nil {
		return map[string]string{"error": "card not found"}, http.StatusNotFound
	}

	cardToUpdate.Status = "active"
	saveStore()

	return map[string]string{"message": "card activated"}, http.StatusOK
}

func handleAdminRejectCard(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	var req approveReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return map[string]string{"error": "invalid request"}, http.StatusBadRequest
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	var cardToUpdate *Card
	for _, c := range store.Cards {
		if c.ID == req.ID {
			cardToUpdate = c
			break
		}
	}

	if cardToUpdate == nil {
		return map[string]string{"error": "card not found"}, http.StatusNotFound
	}

	cardToUpdate.Status = "rejected"
	saveStore()

	return map[string]string{"message": "card rejected"}, http.StatusOK
}

// handleAdminCards returns all cards for the admin portal
func handleAdminCards(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	store.mu.RLock()
	defer store.mu.RUnlock()

	var allCards []map[string]interface{}
	for accID, c := range store.Cards {
		accName := "Unknown"
		if acc, ok := store.Accounts[accID]; ok {
			accName = acc.Name
		}
		allCards = append(allCards, map[string]interface{}{
			"id":          c.ID,
			"account_id":  c.AccountID,
			"user_name":   accName,
			"card_number": c.CardNumber,
			"expiry":      c.Expiry,
			"type":        c.Type,
			"status":      c.Status,
		})
	}

	return allCards, http.StatusOK
}
