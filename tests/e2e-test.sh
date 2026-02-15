#!/usr/bin/env bash

set -e

export LDAP_TEST_USER="asmith"
export LDAP_TEST_PASS="admin"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo -e "${YELLOW}🔍 Checking Docker LDAP server...${NC}"
if ! docker ps 2>/dev/null | grep -q test-ldap; then
    echo -e "${RED}❌ Docker LDAP server not running${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker LDAP server is running${NC}"
echo -e "${BLUE}🔐 Using test credentials: $LDAP_TEST_USER${NC}\n"

run_test() {
    local test_num=$1
    local test_name=$2
    local command=$3
    local expected=$4
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -e "${YELLOW}Test $test_num: $test_name${NC}"
    echo -e "${BLUE}⏳ Running...${NC}"
    
    set +e
    eval "$command" > /tmp/test_output.txt 2>&1 &
    local pid=$!
    
    local spin='-\|/'
    local i=0
    while kill -0 $pid 2>/dev/null; do
        i=$(( (i+1) %4 ))
        printf "\r${BLUE}⏳ Running... ${spin:$i:1}${NC}"
        sleep 0.1
    done
    wait $pid
    EXIT_CODE=$?
    printf "\r                    \r"
    set -e
    
    if grep -q "$expected" /tmp/test_output.txt; then
        echo -e "${GREEN}✅ PASS${NC}\n"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAIL${NC}"
        echo "Expected: '$expected'"
        echo "Output:"
        head -20 /tmp/test_output.txt
        echo -e "${NC}\n"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

run_test_exit_code() {
    local test_num=$1
    local test_name=$2
    local command=$3
    local expected_code=$4
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -e "${YELLOW}Test $test_num: $test_name${NC}"
    echo -e "${BLUE}⏳ Running...${NC}"
    
    set +e
    eval "$command" > /tmp/test_output.txt 2>&1
    ACTUAL_CODE=$?
    set -e
    
    if [ $ACTUAL_CODE -eq $expected_code ]; then
        echo -e "${GREEN}✅ PASS (exit: $ACTUAL_CODE)${NC}\n"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAIL (expected: $expected_code, got: $ACTUAL_CODE)${NC}\n"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}                    FEATURE 1.1 TEST SUITE                                    ${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

run_test "1" "List features" "yarn features" "team-summary"
run_test "2" "Show commands" "yarn commands" "get-ad-groups"
run_test "3" "Single user" "yarn get-ad-groups jdoe" "jdoe"
run_test "4" "Two users" "yarn get-ad-groups jdoe asmith" "shared"
run_test "5" "Three users" "yarn get-ad-groups jdoe asmith bwilson" "unique"
run_test "6" "Team summary (3)" "yarn team-summary jdoe asmith bwilson" "Team Summary Report"
run_test "7" "Team summary (5 max)" "yarn team-summary jdoe asmith bwilson cmartinez dchen" "Team size: 5"
run_test "8" "Team summary (6 over)" "yarn team-summary jdoe asmith bwilson cmartinez dchen ejohnson 2>&1" "MAXIMUM USERS REACHED"
run_test "9" "No args error" "yarn get-ad-groups 2>&1" "No users specified"
run_test "10" "Get-ad-groups over" "yarn get-ad-groups jdoe asmith bwilson cmartinez dchen ejohnson 2>&1" "Maximum 5 users"
run_test_exit_code "11" "Success exit" "yarn get-ad-groups jdoe" 0
run_test_exit_code "12" "Error exit" "yarn get-ad-groups 2>&1" 1
run_test "13" "Roles in output" "yarn get-ad-groups jdoe" "AP-AWS"
run_test "14" "Clean output" "yarn team-summary jdoe asmith" "Team Summary Report"
run_test "15" "Help hints" "yarn get-ad-groups 2>&1" "yarn commands"
run_test "16" "Recommendations" "yarn team-summary jdoe asmith bwilson" "Recommendations:"

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}                           TEST RESULTS                                        ${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "Total:  $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
[ $FAILED_TESTS -gt 0 ] && echo -e "${RED}Failed: $FAILED_TESTS${NC}" || echo "Failed: $FAILED_TESTS"

PASS_RATE=$(awk "BEGIN {printf \"%.1f\", ($PASSED_TESTS/$TOTAL_TESTS)*100}")
echo -e "\nPass Rate: $PASS_RATE%"

rm -f /tmp/test_output.txt

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL TESTS PASSED! Ready to commit.${NC}\n"
    exit 0
else
    echo -e "\n${RED}❌ SOME TESTS FAILED${NC}\n"
    exit 1
fi
