package main

import (
	"fmt"
)

func main() {
	// Creating instances that satisfy the Entity interface
	acc := &Account{ID: 99999, Name: "Interface Lab User"}
	card := &Card{ID: 10101, CardNumber: "1234-5678"}

	// function that accepts the interface
	printID := func(e Entity) {
		fmt.Printf("LOG: Processing Entity ID -> %d\n", e.GetID())
	}

	fmt.Println("--- Interface Polymorphism Demo ---")
	printID(acc)  // Account as Entity
	printID(card) // Card as Entity
	fmt.Println("-----------------------------------")
}
