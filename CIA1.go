//go:build legacy
// +build legacy

package main

import (
	"fmt"
	"sort"
)

func main() {
	Vyears := []int{1990, 1947, 2000, 2012, 2023, 2024, 2100, 1985, 1975}
	Inames := []string{"naman", "12321", "sweets", "malayalam", "mela", "101", "isro"}
	fmt.Println(Vyears)
	fmt.Println(Inames)
	var auspYears []int
	for i := 0; i < len(Vyears); i++ {
		if Vyears[i]%4 == 0 && (Vyears[i]%100 != 0 || Vyears[i]%400 == 0) {
			auspYears = append(auspYears, Vyears[i])
		}
	}
	fmt.Println("The auspicious years are:", auspYears)
	var palindromicNames []string
	for i := 0; i < len(Inames); i++ {
		name := Inames[i]
		reversedName := ""
		for j := len(name) - 1; j >= 0; j-- {
			reversedName += string(name[j])
		}
		if name == reversedName {
			palindromicNames = append(palindromicNames, name)
		}
	}
	fmt.Println("The palindromic names are:", palindromicNames)
	yearGhat := map[string][]int{
		"Gate-1": {},
		"Gate-2": {},
		"Gate-3": {},
	}
	for i := 0; i < len(auspYears); i++ {
		year := auspYears[i]
		remainder := year % 3
		if remainder == 0 {
			yearGhat["Gate-0"] = append(yearGhat["Gate-0"], year)
		} else if remainder == 1 {
			yearGhat["Gate-1"] = append(yearGhat["Gate-1"], year)
		} else {
			yearGhat["Gate-2"] = append(yearGhat["Gate-2"], year)
		}
	}
	fmt.Println("Year Ghat Grouping:", yearGhat)

	var unbalancedYears []int
	for i := 0; i < len(Vyears); i++ {
		year := Vyears[i]
		if year%2 != 0 {
			unbalancedYears = append(unbalancedYears, year)
		}
	}
	sort.Ints(unbalancedYears)

	invitationList := unbalancedYears
	if len(unbalancedYears) > 2 {
		invitationList = unbalancedYears[:2]
	}
	fmt.Println("Invitation List:", invitationList)

	fmt.Println("Final Results:")
	fmt.Println("Palindromic Names Map:", palindromicNames)
	fmt.Println("Year Ghat Allocation:", yearGhat)
	fmt.Println("Invitation Slice:", invitationList)
}
