package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
	"github.com/joho/godotenv"
)

// using in-memory file Store (store.go)
var _ = ""

func main() {
	// load .env file if it exists
	_ = godotenv.Load()

	// config
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// load file store
	if err := loadStore(); err != nil {
		log.Fatal(err)
	}

	// HTTP server using net/http
	fs := http.FileServer(http.Dir("./web"))
	// Keep /static/ for CSS/JS backward compatibility
	http.Handle("/static/", http.StripPrefix("/static/", fs))
	// Serve HTML pages directly at root
	http.Handle("/", fs)

	http.HandleFunc("/api/register", wrapJSON(handleRegister))
	http.HandleFunc("/api/login", wrapJSON(handleLogin))
	http.HandleFunc("/api/refresh", wrapJSON(handleRefresh))
	http.HandleFunc("/api/logout", wrapJSON(handleLogout))
	http.HandleFunc("/api/oauth/google", wrapJSON(handleOAuthGoogle))
	http.HandleFunc("/api/oauth/callback", wrapJSON(handleOAuthCallback))

	// protected endpoints use session middleware
	http.HandleFunc("/api/me", authOnly(wrapJSON(handleMe)))
	http.HandleFunc("/api/deposit", authOnly(wrapJSON(handleDeposit)))
	http.HandleFunc("/api/withdraw", authOnly(wrapJSON(handleWithdraw)))
	http.HandleFunc("/api/transactions", authOnly(wrapJSON(handleTransactions)))
	http.HandleFunc("/api/transfer", authOnly(wrapJSON(handleTransfer)))
	http.HandleFunc("/api/cards", authOnly(wrapJSON(handleGetCards)))
	http.HandleFunc("/api/cards/new", authOnly(wrapJSON(handleCreateCard)))
	http.HandleFunc("/api/loans", authOnly(wrapJSON(handleGetLoans)))
	http.HandleFunc("/api/loans/apply", authOnly(wrapJSON(handleApplyLoan)))
	http.HandleFunc("/api/change-password", authOnly(wrapJSON(handleChangePassword)))
	http.HandleFunc("/api/profile/update", authOnly(wrapJSON(handleUpdateProfile)))

	// Phase 5: Extended Modules
	http.HandleFunc("/api/wealth/fd", authOnly(wrapJSON(handleGetWealthFD)))
	http.HandleFunc("/api/wealth/mf", authOnly(wrapJSON(handleGetWealthMF)))
	http.HandleFunc("/api/wealth/sip/create", authOnly(wrapJSON(handleCreateSIP)))
	http.HandleFunc("/api/wealth/demat", authOnly(wrapJSON(handleGetDemat)))
	http.HandleFunc("/api/bills", authOnly(wrapJSON(handleGetBills)))
	http.HandleFunc("/api/bills/pay", authOnly(wrapJSON(handlePayBill)))

	http.HandleFunc("/api/corporate/trades", authOnly(wrapJSON(handleGetCorporateTrades)))
	http.HandleFunc("/api/corporate/bulk_payment", authOnly(wrapJSON(handleBulkPaymentSubmit)))
	http.HandleFunc("/api/corporate/approve_trade", authOnly(wrapJSON(handleApproveTrade)))
	http.HandleFunc("/api/transfer/advanced", authOnly(wrapJSON(handleAdvancedTransfer)))

	// admin endpoints
	http.HandleFunc("/api/admin/login", wrapJSON(handleAdminLogin))
	http.HandleFunc("/api/admin/stats", authOnly(wrapJSON(handleAdminStats)))
	http.HandleFunc("/api/admin/users", authOnly(wrapJSON(handleAdminUsers)))
	http.HandleFunc("/api/admin/user/detail", authOnly(wrapJSON(handleAdminUserDetail)))
	http.HandleFunc("/api/admin/users/delete", authOnly(wrapJSON(handleAdminDeleteUser)))
	http.HandleFunc("/api/admin/loans/approve", authOnly(wrapJSON(handleAdminApproveLoan)))
	http.HandleFunc("/api/admin/loans/reject", authOnly(wrapJSON(handleAdminRejectLoan)))
	http.HandleFunc("/api/admin/cards/approve", authOnly(wrapJSON(handleAdminApproveCard)))
	http.HandleFunc("/api/admin/cards/reject", authOnly(wrapJSON(handleAdminRejectCard)))
	http.HandleFunc("/api/admin/cards", authOnly(wrapJSON(handleAdminCards)))

	fmt.Printf("Server running on :%s\n", port)
	if err := http.ListenAndServe("0.0.0.0:"+port, nil); err != nil {
		log.Fatal(err)
	}
}

// helper to write json responses
type jsonHandler func(http.ResponseWriter, *http.Request) (interface{}, int)

func wrapJSON(h jsonHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		res, status := h(w, r)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		if res != nil {
			json.NewEncoder(w).Encode(res)
		}
	}
}

// authOnly ensures a valid session exists and stores account_id in context
func authOnly(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := getAccountIDFromSession(r)
		if err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "unauthorized"})
			return
		}
		ctx := context.WithValue(r.Context(), "account_id", id)
		h(w, r.WithContext(ctx))
	}
}

func getAccountIDFromSession(r *http.Request) (int64, error) {
	cookie, err := r.Cookie("session_token")
	if err != nil {
		return 0, fmt.Errorf("no session")
	}
	h := sha256.Sum256([]byte(cookie.Value))
	hs := hex.EncodeToString(h[:])
	id, expiresStr, ok := getSessionAccount(hs)
	if !ok {
		return 0, fmt.Errorf("invalid session")
	}
	expires, _ := time.Parse(time.RFC3339, expiresStr)
	if time.Now().After(expires) {
		_ = deleteSession(hs)
		return 0, fmt.Errorf("expired")
	}
	return id, nil
}
