package main

import (
	"testing"
)

func TestHashTokenDeterministic(t *testing.T) {
	a := hashToken("abc123")
	b := hashToken("abc123")
	if a != b {
		t.Fatalf("expected deterministic hash, got %s and %s", a, b)
	}
}
