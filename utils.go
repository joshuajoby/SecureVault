package main

import (
	"crypto/sha256"
	"encoding/hex"
)

func hashToken(t string) string {
	h := sha256.Sum256([]byte(t))
	return hex.EncodeToString(h[:])
}
