package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"
)

// --- CONCEPTS (Interfaces) ---
type Entity interface {
	GetID() int64
}

type Account struct {
	ID            int64   `json:"id"`
	AccountNumber int     `json:"account_number"`
	Name          string  `json:"name"`
	PasswordHash  string  `json:"password_hash"`
	Balance       float64 `json:"balance"`
	HasCard       bool    `json:"has_card"`
}

func (a *Account) GetID() int64 { return a.ID }

type Card struct {
	ID         int64  `json:"id"`
	AccountID  int64  `json:"account_id"`
	CardNumber string `json:"card_number"`
	Expiry     string `json:"expiry"`
	CVV        string `json:"cvv"`
	Type       string `json:"type"`
	Status     string `json:"status"` // "pending", "active", "rejected"
}

func (c *Card) GetID() int64 { return c.ID }

type Loan struct {
	ID           int64   `json:"id"`
	AccountID    int64   `json:"account_id"`
	Amount       float64 `json:"amount"`
	Status       string  `json:"status"` // "pending", "approved", "rejected"
	InterestRate float64 `json:"interest_rate"`
}

func (l *Loan) GetID() int64 { return l.ID }

type Transaction struct {
	ID        int64   `json:"id"`
	AccountID int64   `json:"account_id"`
	Type      string  `json:"type"`
	Amount    float64 `json:"amount"`
	CreatedAt string  `json:"created_at"`
}

type Session struct {
	TokenHash string `json:"token_hash"`
	AccountID int64  `json:"account_id"`
	ExpiresAt string `json:"expires_at"`
}

// --- NEW MODULE STRUCTS (PHASE 5) ---

// Wealth Management
type FixedDeposit struct {
	ID        int64   `json:"id"`
	AccountID int64   `json:"account_id"`
	Amount    float64 `json:"amount"`
	Interest  float64 `json:"interest"`
	Maturity  string  `json:"maturity"`
}

type MutualFund struct {
	ID        int64   `json:"id"`
	AccountID int64   `json:"account_id"`
	FundName  string  `json:"fund_name"`
	Units     float64 `json:"units"`
	NAV       float64 `json:"nav"`
}

type SIP struct {
	ID        int64   `json:"id"`
	AccountID int64   `json:"account_id"`
	FundName  string  `json:"fund_name"`
	Amount    float64 `json:"amount"`
	Frequency string  `json:"frequency"` // "monthly", "weekly"
	NextDate  string  `json:"next_date"`
}

type DematHolding struct {
	ID        int64   `json:"id"`
	AccountID int64   `json:"account_id"`
	StockName string  `json:"stock_name"`
	Ticker    string  `json:"ticker"`
	Quantity  int     `json:"quantity"`
	AvgPrice  float64 `json:"avg_price"`
}

// Payments & Bills
type Bill struct {
	ID        int64   `json:"id"`
	AccountID int64   `json:"account_id"`
	Biller    string  `json:"biller"`
	Amount    float64 `json:"amount"`
	DueDate   string  `json:"due_date"`
	Status    string  `json:"status"` // "pending", "paid"
}

// Corporate/Business
type CorporateTrade struct {
	ID        int64   `json:"id"`
	AccountID int64   `json:"account_id"`
	Type      string  `json:"type"` // "LetterOfCredit", "BankGuarantee"
	Amount    float64 `json:"amount"`
	Status    string  `json:"status"`
	Approvals int     `json:"approvals"` // Multi-level approval count
}

type BulkPayment struct {
	ID          int64   `json:"id"`
	AccountID   int64   `json:"account_id"`
	Title       string  `json:"title"`
	TotalAmount float64 `json:"total_amount"`
	TxCount     int     `json:"tx_count"`
	Status      string  `json:"status"` // "pending", "processed"
}

type Store struct {
	mu                sync.RWMutex        `json:"-"`
	NextAccountID     int64               `json:"next_account_id"`
	NextTransactionID int64               `json:"next_transaction_id"`
	NextCardID        int64               `json:"next_card_id"`
	NextLoanID        int64               `json:"next_loan_id"`
	NextFDID          int64               `json:"next_fd_id"`
	NextMFID          int64               `json:"next_mf_id"`
	NextSIPID         int64               `json:"next_sip_id"`
	NextDematID       int64               `json:"next_demat_id"`
	NextBillID        int64               `json:"next_bill_id"`
	NextTradeID       int64               `json:"next_trade_id"`
	NextBulkID        int64               `json:"next_bulk_id"`
	Accounts          map[int64]*Account  `json:"accounts"`
	ByAccountNumber   map[int]int64       `json:"by_account_number"`
	Transactions      []*Transaction      `json:"transactions"`
	Sessions          map[string]*Session `json:"sessions"`
	Cards             map[int64]*Card     `json:"cards"` // AccountID -> Card
	Loans             []*Loan             `json:"loans"`
	FixedDeposits     []*FixedDeposit     `json:"fixed_deposits"`
	MutualFunds       []*MutualFund       `json:"mutual_funds"`
	SIPs              []*SIP              `json:"sips"`
	DematHoldings     []*DematHolding     `json:"demat_holdings"`
	Bills             []*Bill             `json:"bills"`
	CorporateTrades   []*CorporateTrade   `json:"corporate_trades"`
	BulkPayments      []*BulkPayment      `json:"bulk_payments"`
}

var store *Store
var storePath = "store.json"

func loadStore() error {
	if store != nil {
		return nil
	}
	s := &Store{
		Accounts:        map[int64]*Account{},
		ByAccountNumber: map[int]int64{},
		Sessions:        map[string]*Session{},
		Cards:           map[int64]*Card{},
		Loans:           []*Loan{},
		FixedDeposits:   []*FixedDeposit{},
		MutualFunds:     []*MutualFund{},
		SIPs:            []*SIP{},
		DematHoldings:   []*DematHolding{},
		Bills:           []*Bill{},
		CorporateTrades: []*CorporateTrade{},
		BulkPayments:    []*BulkPayment{},
	}
	if _, err := os.Stat(storePath); err == nil {
		b, err := os.ReadFile(storePath)
		if err == nil {
			json.Unmarshal(b, s)
		}
	}
	store = s
	return nil
}

func saveStore() error {
	b, err := json.MarshalIndent(store, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(storePath, b, 0644)
}

func createAccount(accNum int, name, passwordHash string, balance float64) (int64, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	// check unique
	if _, ok := store.ByAccountNumber[accNum]; ok {
		return 0, nil
	}
	store.NextAccountID++
	id := store.NextAccountID
	a := &Account{ID: id, AccountNumber: accNum, Name: name, PasswordHash: passwordHash, Balance: balance}
	store.Accounts[id] = a
	store.ByAccountNumber[accNum] = id
	return id, saveStore()
}

func getAccountByNumber(accNum int) (*Account, bool) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	id, ok := store.ByAccountNumber[accNum]
	if !ok {
		return nil, false
	}
	return store.Accounts[id], true
}

func getAccountByID(id int64) (*Account, bool) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	a, ok := store.Accounts[id]
	return a, ok
}

func updateBalance(id int64, delta float64) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	if a, ok := store.Accounts[id]; ok {
		a.Balance += delta
		// add transaction
		store.NextTransactionID++
		tx := &Transaction{ID: store.NextTransactionID, AccountID: id, Type: func() string {
			if delta >= 0 {
				return "deposit"
			}
			return "withdraw"
		}(), Amount: delta, CreatedAt: time.Now().Format(time.RFC3339)}
		store.Transactions = append(store.Transactions, tx)
		return saveStore()
	}
	return nil
}

func listTransactionsForAccount(id int64) []*Transaction {
	store.mu.RLock()
	defer store.mu.RUnlock()
	var out []*Transaction
	for i := len(store.Transactions) - 1; i >= 0; i-- {
		if store.Transactions[i].AccountID == id {
			out = append(out, store.Transactions[i])
		}
	}
	return out
}

func createSession(hashTok string, accountID int64, expires time.Time) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	s := &Session{TokenHash: hashTok, AccountID: accountID, ExpiresAt: expires.Format(time.RFC3339)}
	store.Sessions[hashTok] = s
	return saveStore()
}

func getSessionAccount(hashTok string) (int64, string, bool) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	s, ok := store.Sessions[hashTok]
	if !ok {
		return 0, "", false
	}
	return s.AccountID, s.ExpiresAt, true
}

func deleteSession(hashTok string) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	delete(store.Sessions, hashTok)
	return saveStore()
}

// --- EXTENDED BANKING FUNCTIONS ---

func transferFunds(fromID int64, toAccountNum int, amount float64) error {
	store.mu.Lock()
	defer store.mu.Unlock()

	fromAcc, ok1 := store.Accounts[fromID]
	toID, ok2 := store.ByAccountNumber[toAccountNum]

	if !ok1 || !ok2 {
		return fmt.Errorf("account not found")
	}
	if fromID == toID {
		return fmt.Errorf("cannot transfer to self")
	}
	if fromAcc.Balance < amount {
		return fmt.Errorf("insufficient funds")
	}

	toAcc := store.Accounts[toID]

	// Update balances
	fromAcc.Balance -= amount
	toAcc.Balance += amount

	now := time.Now().Format(time.RFC3339)

	// Record outgoing tx
	store.NextTransactionID++
	txOut := &Transaction{ID: store.NextTransactionID, AccountID: fromID, Type: "transfer_out", Amount: amount, CreatedAt: now}
	store.Transactions = append(store.Transactions, txOut)

	// Record incoming tx
	store.NextTransactionID++
	txIn := &Transaction{ID: store.NextTransactionID, AccountID: toID, Type: "transfer_in", Amount: amount, CreatedAt: now}
	store.Transactions = append(store.Transactions, txIn)

	return saveStore()
}

func createCard(accountID int64, cardType string) (*Card, error) {
	store.mu.Lock()
	defer store.mu.Unlock()

	acc, ok := store.Accounts[accountID]
	if !ok {
		return nil, fmt.Errorf("account not found")
	}
	if acc.HasCard {
		return store.Cards[accountID], fmt.Errorf("card already exists for this account")
	}

	store.NextCardID++
	id := store.NextCardID

	// Generate mock card number
	cardNum := fmt.Sprintf("4111%012d", id*987654+accountID)
	expiry := time.Now().AddDate(4, 0, 0).Format("01/06") // 4 years from now
	cvv := fmt.Sprintf("%03d", (id*73)%1000)

	card := &Card{
		ID:         id,
		AccountID:  accountID,
		CardNumber: cardNum,
		Expiry:     expiry,
		CVV:        cvv,
		Type:       cardType,
		Status:     "pending", // Requires admin approval
	}

	store.Cards[accountID] = card
	acc.HasCard = true

	return card, saveStore()
}

func getCard(accountID int64) (*Card, bool) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	c, ok := store.Cards[accountID]
	return c, ok
}

func applyForLoan(accountID int64, amount float64) (*Loan, error) {
	store.mu.Lock()
	defer store.mu.Unlock()

	if _, ok := store.Accounts[accountID]; !ok {
		return nil, fmt.Errorf("account not found")
	}

	store.NextLoanID++
	id := store.NextLoanID

	loan := &Loan{
		ID:           id,
		AccountID:    accountID,
		Amount:       amount,
		Status:       "pending", // Requires admin approval
		InterestRate: 5.5,
	}

	store.Loans = append(store.Loans, loan)

	// Note: We no longer auto-deposit the loan amount here. That happens
	// in handlers_admin.go when an admin approves the loan.

	return loan, saveStore()
}

func listLoansForAccount(accountID int64) []*Loan {
	store.mu.RLock()
	defer store.mu.RUnlock()

	var out []*Loan
	for i := len(store.Loans) - 1; i >= 0; i-- {
		if store.Loans[i].AccountID == accountID {
			out = append(out, store.Loans[i])
		}
	}
	return out
}

// --- ADMIN FUNCTIONS ---
// Demonstrating Go concepts: arrays, slices, maps, control flow

func getAllUsers() []*Account {
	store.mu.RLock()
	defer store.mu.RUnlock()

	// Create a slice using make
	users := make([]*Account, 0, len(store.Accounts))

	// Iterating over a map using for range
	for _, acc := range store.Accounts {
		users = append(users, acc)
	}
	return users
}

func getPlatformStats() map[string]interface{} {
	store.mu.RLock()
	defer store.mu.RUnlock()

	var totalDeposits float64 // zero value is 0.0
	var totalWithdrawals float64

	// Control flow and range over slice
	for _, tx := range store.Transactions {
		if tx.Type == "deposit" {
			totalDeposits += tx.Amount
		} else if tx.Type == "withdraw" {
			totalWithdrawals += tx.Amount
		}
	}

	// Multi-dimensional slice example: storing a simple matrix for reports
	// e.g., representing [Deposits, Withdrawals, Net]
	var reportMatrix [][]float64
	row1 := []float64{totalDeposits, totalWithdrawals, totalDeposits - totalWithdrawals}
	reportMatrix = append(reportMatrix, row1)

	// Short declaration operator
	totalUsers := len(store.Accounts)
	totalCards := len(store.Cards)
	totalLoans := len(store.Loans)

	return map[string]interface{}{
		"total_users":       totalUsers,
		"total_deposits":    totalDeposits,
		"total_withdrawals": totalWithdrawals,
		"net_balance":       reportMatrix[0][2],
		"report_matrix":     reportMatrix,
		"total_cards":       totalCards,
		"total_loans":       totalLoans,
	}
}

func deleteUser(id int64) error {
	store.mu.Lock()
	defer store.mu.Unlock()

	acc, exists := store.Accounts[id]
	if !exists {
		return nil
	}

	// Delete from map
	delete(store.Accounts, id)
	delete(store.ByAccountNumber, acc.AccountNumber)

	// Delete from slice pattern (remove all transactions for this user)
	var newTxs []*Transaction
	for _, tx := range store.Transactions {
		if tx.AccountID != id {
			newTxs = append(newTxs, tx)
		}
	}
	store.Transactions = newTxs

	// Optional: remove their sessions
	for hashTok, s := range store.Sessions {
		if s.AccountID == id {
			delete(store.Sessions, hashTok)
		}
	}

	return saveStore()
}

// --- PHASE 5 MOCK DATA GENERATORS ---

func getFixedDeposits(accountID int64) []*FixedDeposit {
	store.mu.Lock()
	defer store.mu.Unlock()

	var out []*FixedDeposit
	for _, fd := range store.FixedDeposits {
		if fd.AccountID == accountID {
			out = append(out, fd)
		}
	}

	// Auto-mock if empty
	if len(out) == 0 {
		store.NextFDID++
		fd1 := &FixedDeposit{ID: store.NextFDID, AccountID: accountID, Amount: 10000, Interest: 7.1, Maturity: time.Now().AddDate(1, 0, 0).Format("02 Jan 2006")}
		store.NextFDID++
		fd2 := &FixedDeposit{ID: store.NextFDID, AccountID: accountID, Amount: 50000, Interest: 6.5, Maturity: time.Now().AddDate(5, 0, 0).Format("02 Jan 2006")}

		store.FixedDeposits = append(store.FixedDeposits, fd1, fd2)
		out = append(out, fd1, fd2)
		saveStore()
	}

	return out
}

func getMutualFunds(accountID int64) []*MutualFund {
	store.mu.Lock()
	defer store.mu.Unlock()

	var out []*MutualFund
	for _, mf := range store.MutualFunds {
		if mf.AccountID == accountID {
			out = append(out, mf)
		}
	}

	if len(out) == 0 {
		store.NextMFID++
		mf1 := &MutualFund{ID: store.NextMFID, AccountID: accountID, FundName: "HDFC Top 100 Fund", Units: 145.2, NAV: 840.15}
		store.NextMFID++
		mf2 := &MutualFund{ID: store.NextMFID, AccountID: accountID, FundName: "SBI Bluechip", Units: 600.0, NAV: 65.50}

		store.MutualFunds = append(store.MutualFunds, mf1, mf2)
		out = append(out, mf1, mf2)
		saveStore()
	}

	return out
}

func getBills(accountID int64) []*Bill {
	store.mu.Lock()
	defer store.mu.Unlock()

	var out []*Bill
	for _, b := range store.Bills {
		if b.AccountID == accountID && b.Status == "pending" {
			out = append(out, b)
		}
	}

	// Count total bills for this account (including paid) to decide whether to seed
	totalForAccount := 0
	for _, b := range store.Bills {
		if b.AccountID == accountID {
			totalForAccount++
		}
	}

	if totalForAccount == 0 {
		store.NextBillID++
		b1 := &Bill{ID: store.NextBillID, AccountID: accountID, Biller: "Jio Fiber", Amount: 999.00, DueDate: time.Now().AddDate(0, 0, 5).Format("02 Jan"), Status: "pending"}
		store.NextBillID++
		b2 := &Bill{ID: store.NextBillID, AccountID: accountID, Biller: "Electricity Board", Amount: 2450.50, DueDate: time.Now().AddDate(0, 0, 12).Format("02 Jan"), Status: "pending"}

		store.Bills = append(store.Bills, b1, b2)
		out = append(out, b1, b2)
		saveStore()
	}
	return out
}

func getCorporateTrades(accountID int64) []*CorporateTrade {
	store.mu.Lock()
	defer store.mu.Unlock()

	var out []*CorporateTrade
	for _, t := range store.CorporateTrades {
		if t.AccountID == accountID {
			out = append(out, t)
		}
	}

	if len(out) == 0 {
		store.NextTradeID++
		t1 := &CorporateTrade{ID: store.NextTradeID, AccountID: accountID, Type: "LetterOfCredit", Amount: 500000.00, Status: "Active"}
		store.NextTradeID++
		t2 := &CorporateTrade{ID: store.NextTradeID, AccountID: accountID, Type: "BankGuarantee", Amount: 1250000.00, Status: "Pending Approval"}

		store.CorporateTrades = append(store.CorporateTrades, t1, t2)
		out = append(out, t1, t2)
		saveStore()
	}
	return out
}
