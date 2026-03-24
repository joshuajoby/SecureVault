package main

import (
	"fmt"
	"testing"
)

func TestInterfaceDemo(t *testing.T) {
	acc := &Account{ID: 99999, Name: "Interface Lab User"}
	card := &Card{ID: 10101, CardNumber: "1234-5678"}

	printID := func(e Entity) {
		fmt.Printf("LOG: Processing Entity ID -> %d\n", e.GetID())
	}

	fmt.Println("\n--- Interface Polymorphism Demo ---")
	printID(acc)
	printID(card)
	fmt.Println("-----------------------------------")
}
