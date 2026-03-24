package main

import (
	"os"
	"testing"
)

func TestCreateAndFetchAccount(t *testing.T) {
	_ = os.Remove(storePath)
	if err := loadStore(); err != nil {
		t.Fatalf("load store: %v", err)
	}
	id, err := createAccount(9999, "Test", "hash", 10)
	if err != nil || id == 0 {
		t.Fatalf("create account failed: %v", err)
	}
	if acc, ok := getAccountByNumber(9999); !ok || acc.Name != "Test" {
		t.Fatalf("could not fetch created account")
	}
}
