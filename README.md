# SecureVault 🏦

[![Go Version](https://img.shields.io/github/go-mod/go-version/joshuajoby/SecureVault)](https://golang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/github/actions/workflow/status/joshuajoby/SecureVault/go.yml?branch=main)](https://github.com/joshuajoby/SecureVault/actions)

**SecureVault** is a cutting-edge, comprehensive banking and wealth management application built with Go. It features a modern, responsive web interface and a robust backend designed for security, scalability, and ease of use.

## 🌟 Key Features

### 🏦 Retail Banking
- **Multi-Account Support**: Seamlessly manage deposits, withdrawals, and local transfers.
- **Transaction History**: Real-time tracking of all activities with interactive chart visualizations.
- **Card Management**: Apply for and manage Debit/Credit cards with admin-level approval workflows.
- **Loan Services**: Integrated loan application system with interest rate tracking and approval status.

### 💼 Wealth & Corporate
- **Investment Portfolio**: Track Fixed Deposits, Mutual Funds, and SIPs with maturity and NAV tracking.
- **Demat Integration**: View stock holdings and portfolio performance.
- **Corporate Banking**: Support for "Letter of Credit", "Bank Guarantee", and "Bulk Payments".
- **Bill Payments**: Integrated biller system for utility payments (Electricity, Internet, etc.).

### 🔒 Security & Auth
- **Advanced Auth**: Session-based authentication with token hashing.
- **2FA/TOTP**: Optional Two-Factor Authentication for enhanced account security.
- **Profile Controls**: Secure password changes and profile metadata management.
- **OAuth2 Ready**: Scaffolded support for Google OAuth integration.

### 🛠 Administrative Panel
- **User Analytics**: Real-time stats on total users, deposits, and platform net balance.
- **User Management**: Admin controls for viewing, managing, or deleting user accounts.
- **Approval Queue**: Centralized hub for approving card requests and loan applications.

---

## 🚀 Tech Stack

- **Backend**: Go (Standard Library `net/http`)
- **Frontend**: HTML5, Vanilla JavaScript, CSS3 (Glassmorphism & Bootstrap components)
- **Data Persistence**: JSON-based file storage (Atomic operations via `sync.RWMutex`)
- **DevOps**: Docker, Docker Compose, GitHub Actions
- **Security**: SHA-256 hashing, Session management, TOTP (HRP)

---

## 🛠 Getting Started

### Prerequisites
- [Go 1.21+](https://golang.org/dl/)
- [Docker](https://www.docker.com/get-started) (optional for containerized setup)

### Local Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/joshuajoby/SecureVault.git
   cd SecureVault
   ```

2. **Set up Environment Variables**:
   Create a `.env` file or set them in your terminal:
   ```bash
   set JWT_SECRET=your_secure_secret
   set PORT=8080
   ```

3. **Install dependencies**:
   ```bash
   go mod tidy
   ```

4. **Run the application**:
   ```bash
   go run .
   ```
   Open your browser and navigate to `http://localhost:8080`.

### Docker Setup
```bash
docker-compose up --build
```

---

## 📂 Project Structure

- `/web`: Frontend assets (HTML, CSS, JS)
- `main.go`: Entry point and HTTP routing
- `store.go`: Data structures and persistence logic
- `handlers_*.go`: Feature-specific request handlers (Auth, Bank, Admin)
- `utils.go`: Common utility functions
- `store.json`: Local data storage file (Generated at runtime)
