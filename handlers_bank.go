package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type amountReq struct {
	Amount float64 `json:"amount"`
}

func handleDeposit(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	var req amountReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Amount <= 0 {
		return map[string]string{"error": "invalid amount"}, http.StatusBadRequest
	}
	val := r.Context().Value("account_id")
	accountID := val.(int64)
	if err := updateBalance(accountID, req.Amount); err != nil {
		return map[string]string{"error": "could not deposit"}, http.StatusInternalServerError
	}
	return map[string]string{"message": "deposited"}, http.StatusOK
}

func handleWithdraw(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	var req amountReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Amount <= 0 {
		return map[string]string{"error": "invalid amount"}, http.StatusBadRequest
	}
	val := r.Context().Value("account_id")
	accountID := val.(int64)
	if a, ok := getAccountByID(accountID); !ok {
		return map[string]string{"error": "could not fetch balance"}, http.StatusInternalServerError
	} else if req.Amount > a.Balance {
		return map[string]string{"error": "insufficient funds"}, http.StatusBadRequest
	}
	if err := updateBalance(accountID, -req.Amount); err != nil {
		return map[string]string{"error": "could not withdraw"}, http.StatusInternalServerError
	}
	return map[string]string{"message": "withdrawn"}, http.StatusOK
}

func handleTransactions(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	val := r.Context().Value("account_id")
	accountID := val.(int64)
	txs := listTransactionsForAccount(accountID)
	out := make([]map[string]interface{}, 0, len(txs))
	for _, t := range txs {
		amount := t.Amount
		if amount < 0 {
			amount = -amount // return as positive; type field indicates direction
		}
		out = append(out, map[string]interface{}{"id": t.ID, "type": t.Type, "amount": amount, "created_at": t.CreatedAt})
	}
	return map[string]interface{}{"transactions": out}, http.StatusOK
}

// --- EXTENDED HANDLERS ---

type transferReq struct {
	AccountNumber int     `json:"account_number"`
	Amount        float64 `json:"amount"`
}

func handleTransfer(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	var req transferReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Amount <= 0 {
		return map[string]string{"error": "invalid transfer request"}, http.StatusBadRequest
	}

	val := r.Context().Value("account_id")
	accountID := val.(int64)

	if err := transferFunds(accountID, req.AccountNumber, req.Amount); err != nil {
		return map[string]string{"error": err.Error()}, http.StatusBadRequest
	}

	return map[string]string{"message": "transfer successful"}, http.StatusOK
}

func handleGetCards(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	val := r.Context().Value("account_id")
	accountID := val.(int64)

	if card, ok := getCard(accountID); ok {
		return []interface{}{card}, http.StatusOK // return as array for future expansion
	}
	return []interface{}{}, http.StatusOK
}

type cardReq struct {
	Type string `json:"type"` // "debit" or "credit"
}

func handleCreateCard(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	var req cardReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return map[string]string{"error": "invalid card request"}, http.StatusBadRequest
	}
	if req.Type == "" {
		req.Type = "debit" // default
	}

	val := r.Context().Value("account_id")
	accountID := val.(int64)

	card, err := createCard(accountID, req.Type)
	if err != nil {
		return map[string]string{"error": err.Error()}, http.StatusBadRequest
	}

	return card, http.StatusOK
}

func handleGetLoans(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	val := r.Context().Value("account_id")
	accountID := val.(int64)

	loans := listLoansForAccount(accountID)
	return loans, http.StatusOK
}

type loanReq struct {
	Amount float64 `json:"amount"`
}

func handleApplyLoan(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	var req loanReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Amount <= 0 {
		return map[string]string{"error": "invalid loan request"}, http.StatusBadRequest
	}

	val := r.Context().Value("account_id")
	accountID := val.(int64)

	loan, err := applyForLoan(accountID, req.Amount)
	if err != nil {
		return map[string]string{"error": err.Error()}, http.StatusInternalServerError
	}

	return loan, http.StatusOK
}

// --- PHASE 5 MOCK HANDLERS ---

// --- CORPORATE BANKING IMPLEMENTATION (PHASE 2) ---

type bulkPaymentReq struct {
	Title       string  `json:"title"`
	TotalAmount float64 `json:"total_amount"`
	TxCount     int     `json:"tx_count"`
}

func handleBulkPaymentSubmit(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	// Demonstrating Go's short declaration operator (:=) vs var
	// 'var' is useful when declaring a variable without an initial value, or when you want specific zero-value typing.
	var req bulkPaymentReq

	// ':=' is a short declaration operator, declaring and initializing in one step. It infers the type.
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil || req.TotalAmount <= 0 {
		return map[string]string{"error": "invalid bulk payment request"}, http.StatusBadRequest
	}

	val := r.Context().Value("account_id")
	accountID := val.(int64)

	store.mu.Lock()
	store.NextBulkID++
	id := store.NextBulkID
	bp := &BulkPayment{
		ID:          id,
		AccountID:   accountID,
		Title:       req.Title,
		TotalAmount: req.TotalAmount,
		TxCount:     req.TxCount,
		Status:      "pending", // requires approval
	}
	store.BulkPayments = append(store.BulkPayments, bp)
	store.mu.Unlock()
	saveStore()

	return bp, http.StatusOK
}

type tradeApproveReq struct {
	TradeID int64 `json:"trade_id"`
}

func handleApproveTrade(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	var req tradeApproveReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return map[string]string{"error": "invalid request"}, http.StatusBadRequest
	}

	val := r.Context().Value("account_id")
	accountID := val.(int64)

	store.mu.Lock()
	defer store.mu.Unlock()

	var updatedTrade *CorporateTrade
	for _, t := range store.CorporateTrades {
		if t.ID == req.TradeID && t.AccountID == accountID {
			t.Approvals++
			if t.Approvals >= 2 {
				t.Status = "Active"
			} else {
				t.Status = "Pending Level 2"
			}
			updatedTrade = t
			break
		}
	}

	if updatedTrade == nil {
		return map[string]string{"error": "trade not found or unauthorized"}, http.StatusNotFound
	}

	saveStore()
	return updatedTrade, http.StatusOK
}

// --- WEALTH & INVESTMENT (PHASE 3) ---

// Example of an embedded struct for demonstration
// Go allows embedding structs rather than classical inheritance.
type AssetDetails struct {
	Platform string `json:"platform"`
	Risk     string `json:"risk"`
}

type sipReq struct {
	FundName  string  `json:"fund_name"`
	Amount    float64 `json:"amount"`
	Frequency string  `json:"frequency"`

	// Embedding the struct here gives sipReq all fields of AssetDetails
	AssetDetails
}

func handleCreateSIP(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	var req sipReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Amount <= 0 {
		return map[string]string{"error": "invalid SIP request"}, http.StatusBadRequest
	}

	val := r.Context().Value("account_id")
	accountID := val.(int64)

	store.mu.Lock()
	store.NextSIPID++
	sip := &SIP{
		ID:        store.NextSIPID,
		AccountID: accountID,
		FundName:  req.FundName,
		Amount:    req.Amount,
		Frequency: req.Frequency,
		NextDate:  time.Now().AddDate(0, 1, 0).Format("02 Jan 2006"), // next month
	}
	store.SIPs = append(store.SIPs, sip)
	store.mu.Unlock()
	saveStore()

	// Using an anonymous struct to return a custom response shape without defining a top-level type
	response := struct {
		Message string `json:"message"`
		SIP     *SIP   `json:"sip"`
		Risk    string `json:"risk_profile"`
	}{
		Message: "SIP Created successfully",
		SIP:     sip,
		Risk:    req.Risk, // Accessed directly due to embedding
	}

	return response, http.StatusOK
}

func handleGetDemat(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	val := r.Context().Value("account_id")
	accountID := val.(int64)

	store.mu.Lock()
	defer store.mu.Unlock()

	var holdings []*DematHolding
	for _, h := range store.DematHoldings {
		if h.AccountID == accountID {
			holdings = append(holdings, h)
		}
	}

	// mock generation if empty
	if len(holdings) == 0 {
		store.NextDematID++
		h1 := &DematHolding{ID: store.NextDematID, AccountID: accountID, StockName: "Reliance Ind", Ticker: "RELIANCE", Quantity: 50, AvgPrice: 2450.75}
		store.NextDematID++
		h2 := &DematHolding{ID: store.NextDematID, AccountID: accountID, StockName: "HDFC Bank", Ticker: "HDFCBANK", Quantity: 100, AvgPrice: 1640.20}
		store.DematHoldings = append(store.DematHoldings, h1, h2)
		holdings = append(holdings, h1, h2)
		saveStore()
	}

	return holdings, http.StatusOK
}

func handleGetWealthFD(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	val := r.Context().Value("account_id")
	accountID := val.(int64)
	fds := getFixedDeposits(accountID)
	return fds, http.StatusOK
}

// --- PAYMENTS & TRANSFERS (PHASE 4) ---

// Demonstrating Map data structures and Slice manipulation in Go
var (
	// Maps are excellent for fast, unordered lookups.
	// We'll cache UPI IDs to Account IDs mapping here.
	upiDirectory = make(map[string]int64)

	// A slice to act as a recent transaction cache
	recentTxCache = make([]string, 0, 100)
)

type advancedTransferReq struct {
	Type          string  `json:"type"` // "NEFT", "RTGS", "IMPS", "UPI"
	Amount        float64 `json:"amount"`
	TargetAccount int     `json:"target_account,omitempty"`
	TargetUPI     string  `json:"target_upi,omitempty"`
}

func handleAdvancedTransfer(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	var req advancedTransferReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Amount <= 0 {
		return map[string]string{"error": "invalid transfer request"}, http.StatusBadRequest
	}

	val := r.Context().Value("account_id")
	accountID := val.(int64)

	var err error

	// Map lookup demonstration
	if req.Type == "UPI" {
		store.mu.RLock()
		if _, exists := store.ByAccountNumber[req.TargetAccount]; !exists {
			err = fmt.Errorf("UPI or target account not found")
		}
		store.mu.RUnlock()
	} else {
		store.mu.RLock()
		if _, exists := store.ByAccountNumber[req.TargetAccount]; !exists {
			err = fmt.Errorf("target account not found")
		}
		store.mu.RUnlock()
	}

	if err != nil {
		return map[string]string{"error": err.Error()}, http.StatusBadRequest
	}

	err = transferFunds(accountID, req.TargetAccount, req.Amount)
	if err != nil {
		return map[string]string{"error": err.Error()}, http.StatusBadRequest
	}

	// Slice manipulation demonstration (append, delete, make)
	// We append to the slice cache. If the cache gets too big, we 'delete' the oldest entry
	// by slicing from index 1 to the end, removing the first element.
	logEntry := fmt.Sprintf("%s transfer of %.2f by %d", req.Type, req.Amount, accountID)

	// Append element
	recentTxCache = append(recentTxCache, logEntry)

	// If it exceeds arbitrary cache limit (e.g. 10), delete the oldest element (index 0)
	if len(recentTxCache) > 10 {
		// "Delete" by slicing: elements from index 1 to length are kept
		recentTxCache = recentTxCache[1:]
	}

	return map[string]string{
		"message": "Transfer successful via " + req.Type,
		"cached":  fmt.Sprintf("Cache size: %d", len(recentTxCache)),
	}, http.StatusOK
}

func handleGetWealthMF(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	val := r.Context().Value("account_id")
	accountID := val.(int64)
	mfs := getMutualFunds(accountID)
	return mfs, http.StatusOK
}

func handleGetBills(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	val := r.Context().Value("account_id")
	accountID := val.(int64)
	bills := getBills(accountID)
	return bills, http.StatusOK
}

type payBillReq struct {
	BillID int64 `json:"bill_id"`
}

func handlePayBill(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	var req payBillReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.BillID <= 0 {
		return map[string]string{"error": "invalid bill id"}, http.StatusBadRequest
	}

	val := r.Context().Value("account_id")
	accountID := val.(int64)

	store.mu.Lock()
	var bill *Bill
	for _, b := range store.Bills {
		if b.ID == req.BillID && b.AccountID == accountID && b.Status == "pending" {
			bill = b
			break
		}
	}
	if bill == nil {
		store.mu.Unlock()
		return map[string]string{"error": "bill not found or already paid"}, http.StatusNotFound
	}

	// Check balance
	acc, ok := store.Accounts[accountID]
	if !ok || acc.Balance < bill.Amount {
		store.mu.Unlock()
		return map[string]string{"error": "insufficient funds"}, http.StatusBadRequest
	}

	// Mark paid and deduct balance
	bill.Status = "paid"
	acc.Balance -= bill.Amount
	billerName := bill.Biller
	amount := bill.Amount

	// Record transaction
	store.NextTransactionID++
	tx := &Transaction{
		ID:        store.NextTransactionID,
		AccountID: accountID,
		Type:      "withdraw",
		Amount:    -amount,
		CreatedAt: time.Now().Format(time.RFC3339),
	}
	store.Transactions = append(store.Transactions, tx)
	store.mu.Unlock()
	saveStore()

	return map[string]interface{}{
		"message":       "Bill paid successfully",
		"biller":        billerName,
		"amount":        amount,
		"tx_id":         tx.ID,
		"tx_created_at": tx.CreatedAt,
	}, http.StatusOK
}

func handleGetCorporateTrades(w http.ResponseWriter, r *http.Request) (interface{}, int) {
	val := r.Context().Value("account_id")
	accountID := val.(int64)
	trades := getCorporateTrades(accountID)
	return trades, http.StatusOK
}
