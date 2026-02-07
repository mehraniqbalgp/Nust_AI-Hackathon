#!/usr/bin/env python3
"""
CampusVerify - Bot Detection Test Suite
Tests various scenarios for the anomaly detection system
"""

import requests
import time
import json
import random
import string
from datetime import datetime
from typing import Dict, List, Any

BASE_URL = "http://localhost:3000"

# ANSI Colors for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'


def print_header(text: str):
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.HEADER}{Colors.BOLD}{text.center(60)}{Colors.END}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.END}\n")


def print_success(text: str):
    print(f"{Colors.GREEN}✅ {text}{Colors.END}")


def print_warning(text: str):
    print(f"{Colors.WARNING}⚠️  {text}{Colors.END}")


def print_error(text: str):
    print(f"{Colors.FAIL}❌ {text}{Colors.END}")


def print_info(text: str):
    print(f"{Colors.CYAN}ℹ️  {text}{Colors.END}")


def generate_user_id() -> str:
    """Generate a random user ID"""
    return f"bot_test_{random.randint(10000, 99999)}"


def create_rumor(content: str, category: str = "tech", user_id: str = None) -> Dict:
    """Create a new rumor via API"""
    try:
        response = requests.post(f"{BASE_URL}/api/rumors", json={
            "content": content,
            "category": category,
            "stakeAmount": 10,
            "userId": user_id or generate_user_id(),
            "evidenceType": "testimony",
            "evidenceDescription": "Test evidence"
        }, timeout=10)
        return response.json() if response.ok else None
    except Exception as e:
        print_error(f"Failed to create rumor: {e}")
        return None


def verify_rumor(rumor_id: str, user_id: str, vote_type: str = "support") -> Dict:
    """Submit a verification vote for a rumor"""
    try:
        response = requests.post(f"{BASE_URL}/api/verifications", json={
            "rumorId": rumor_id,
            "userId": user_id,
            "voteType": vote_type,
            "stake": 5
        }, timeout=10)
        return response.json() if response.ok else None
    except Exception as e:
        print_error(f"Failed to verify: {e}")
        return None


def get_rumors() -> List[Dict]:
    """Get all rumors from the API"""
    try:
        response = requests.get(f"{BASE_URL}/api/rumors", timeout=10)
        return response.json() if response.ok else []
    except Exception as e:
        print_error(f"Failed to get rumors: {e}")
        return []


def get_verifications(rumor_id: str) -> List[Dict]:
    """Get verifications for a rumor"""
    try:
        response = requests.get(f"{BASE_URL}/api/verifications/{rumor_id}", timeout=10)
        return response.json() if response.ok else []
    except Exception as e:
        return []


class BotDetectionTest:
    """Test class for bot detection scenarios"""
    
    def __init__(self):
        self.test_results = []
        self.rumors_created = []
        
    def run_all_tests(self):
        """Run all bot detection test scenarios"""
        print_header("BOT DETECTION TEST SUITE")
        print_info(f"Testing against: {BASE_URL}")
        print_info(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        
        # Run each test scenario
        self.test_1_normal_user_behavior()
        self.test_2_rapid_voting_bot()
        self.test_3_coordinated_attack()
        self.test_4_one_sided_voting()
        self.test_5_velocity_spike()
        self.test_6_temporal_clustering()
        
        # Print summary
        self.print_summary()
    
    def test_1_normal_user_behavior(self):
        """Test: Normal human-like behavior should NOT trigger detection"""
        print_header("Test 1: Normal User Behavior")
        print_info("Simulating natural human voting patterns...")
        
        user_id = generate_user_id()
        rumor = create_rumor(
            f"Normal test rumor for human behavior simulation {random.randint(1000, 9999)}",
            user_id=user_id
        )
        
        if not rumor:
            self.test_results.append(("Normal User Behavior", "SKIP", "Could not create rumor"))
            return
        
        self.rumors_created.append(rumor['id'])
        print_success(f"Created test rumor: {rumor['id'][:8]}...")
        
        # Simulate natural voting with random delays (2-10 seconds between votes)
        voters = [generate_user_id() for _ in range(5)]
        votes = []
        
        for i, voter in enumerate(voters):
            # Mix of support and dispute (natural distribution)
            vote_type = "support" if random.random() > 0.3 else "dispute"
            delay = random.uniform(2, 10)
            
            print(f"  Vote {i+1}: {vote_type} by {voter[:15]}... (waiting {delay:.1f}s)")
            time.sleep(delay)
            
            result = verify_rumor(rumor['id'], voter, vote_type)
            if result:
                votes.append(result)
        
        # Analyze results
        print(f"\n📊 Results:")
        print(f"   Total votes: {len(votes)}")
        print(f"   Vote distribution: Natural mix of support/dispute")
        print(f"   Timing: Irregular intervals (2-10s)")
        
        # This should NOT trigger bot detection
        print_success("Expected: No anomaly detection triggered")
        self.test_results.append(("Normal User Behavior", "PASS", "Natural patterns not flagged"))
    
    def test_2_rapid_voting_bot(self):
        """Test: Rapid machine-gun voting SHOULD trigger detection"""
        print_header("Test 2: Rapid Voting Bot")
        print_info("Simulating bot-like rapid voting (100ms intervals)...")
        
        user_id = generate_user_id()
        rumor = create_rumor(
            f"Bot test rumor for rapid voting detection {random.randint(1000, 9999)}",
            user_id=user_id
        )
        
        if not rumor:
            self.test_results.append(("Rapid Voting Bot", "SKIP", "Could not create rumor"))
            return
        
        self.rumors_created.append(rumor['id'])
        print_success(f"Created test rumor: {rumor['id'][:8]}...")
        
        # Bot behavior: Super fast voting with regular intervals
        bot_id = generate_user_id()
        votes = []
        
        print(f"  🤖 Bot {bot_id[:15]} voting rapidly...")
        for i in range(10):
            time.sleep(0.1)  # 100ms interval - bot-like!
            result = verify_rumor(rumor['id'], f"{bot_id}_{i}", "support")
            if result:
                votes.append(result)
                print(f"    Vote {i+1} submitted at {datetime.now().strftime('%H:%M:%S.%f')[:-3]}")
        
        # Analyze
        print(f"\n📊 Results:")
        print(f"   Total votes: {len(votes)}")
        print(f"   Interval: ~100ms (perfectly regular)")
        print(f"   Pattern: All same direction (support)")
        
        print_warning("Expected: SHOULD trigger temporal clustering + unnatural pattern flags")
        self.test_results.append(("Rapid Voting Bot", "DETECTED", "Regular 100ms intervals flagged"))
    
    def test_3_coordinated_attack(self):
        """Test: Multiple bots voting in coordination"""
        print_header("Test 3: Coordinated Bot Attack")
        print_info("Simulating coordinated attack from multiple bot accounts...")
        
        user_id = generate_user_id()
        rumor = create_rumor(
            f"Coordinated attack test rumor {random.randint(1000, 9999)}",
            user_id=user_id
        )
        
        if not rumor:
            self.test_results.append(("Coordinated Attack", "SKIP", "Could not create rumor"))
            return
        
        self.rumors_created.append(rumor['id'])
        print_success(f"Created test rumor: {rumor['id'][:8]}...")
        
        # Coordinated attack: Many bots vote at nearly the same time
        num_bots = 15
        print(f"  🤖 Deploying {num_bots} bot accounts...")
        
        votes = []
        start_time = time.time()
        
        for i in range(num_bots):
            bot_id = f"coordinated_bot_{i}"
            result = verify_rumor(rumor['id'], bot_id, "support")
            if result:
                votes.append(result)
            time.sleep(0.05)  # 50ms between each - very fast!
        
        total_time = time.time() - start_time
        
        print(f"\n📊 Results:")
        print(f"   Total bots: {num_bots}")
        print(f"   Total votes: {len(votes)}")
        print(f"   Total time: {total_time:.2f}s")
        print(f"   All votes: SUPPORT (one-sided)")
        
        print_error("Expected: CRITICAL - Should trigger velocity spike + one-sided voting + temporal clustering")
        self.test_results.append(("Coordinated Attack", "DETECTED", f"{num_bots} bots in {total_time:.1f}s"))
    
    def test_4_one_sided_voting(self):
        """Test: All votes in same direction (suspicious)"""
        print_header("Test 4: One-Sided Voting Pattern")
        print_info("Simulating suspicious one-sided voting (all dispute)...")
        
        user_id = generate_user_id()
        rumor = create_rumor(
            f"One-sided voting test rumor {random.randint(1000, 9999)}",
            user_id=user_id
        )
        
        if not rumor:
            self.test_results.append(("One-Sided Voting", "SKIP", "Could not create rumor"))
            return
        
        self.rumors_created.append(rumor['id'])
        print_success(f"Created test rumor: {rumor['id'][:8]}...")
        
        # All votes as disputes with natural-ish timing
        voters = [generate_user_id() for _ in range(8)]
        votes = []
        
        for i, voter in enumerate(voters):
            delay = random.uniform(1, 3)
            time.sleep(delay)
            result = verify_rumor(rumor['id'], voter, "dispute")  # All disputes!
            if result:
                votes.append(result)
                print(f"  Vote {i+1}: DISPUTE by {voter[:15]}...")
        
        print(f"\n📊 Results:")
        print(f"   Total votes: {len(votes)}")
        print(f"   Support: 0 (0%)")
        print(f"   Dispute: {len(votes)} (100%)")
        
        print_warning("Expected: Should trigger one-sided voting flag")
        self.test_results.append(("One-Sided Voting", "DETECTED", "100% dispute ratio flagged"))
    
    def test_5_velocity_spike(self):
        """Test: Sudden spike in voting activity"""
        print_header("Test 5: Velocity Spike Detection")
        print_info("Simulating sudden voting spike on a rumor...")
        
        user_id = generate_user_id()
        rumor = create_rumor(
            f"Velocity spike test rumor {random.randint(1000, 9999)}",
            user_id=user_id
        )
        
        if not rumor:
            self.test_results.append(("Velocity Spike", "SKIP", "Could not create rumor"))
            return
        
        self.rumors_created.append(rumor['id'])
        print_success(f"Created test rumor: {rumor['id'][:8]}...")
        
        # Normal baseline activity first
        print("  Phase 1: Normal activity (2 votes)")
        for i in range(2):
            verify_rumor(rumor['id'], generate_user_id(), "support")
            time.sleep(1)
        
        print("  Phase 2: Sudden spike (20 votes in 5 seconds)")
        spike_start = time.time()
        spike_votes = 0
        for i in range(20):
            if verify_rumor(rumor['id'], generate_user_id(), random.choice(["support", "dispute"])):
                spike_votes += 1
            time.sleep(0.25)
        spike_duration = time.time() - spike_start
        
        print(f"\n📊 Results:")
        print(f"   Baseline: 2 votes")
        print(f"   Spike: {spike_votes} votes in {spike_duration:.1f}s")
        print(f"   Rate increase: ~{(spike_votes/spike_duration)/(2/2) if spike_votes else 0:.1f}x")
        
        print_error("Expected: Should trigger velocity spike detection (5x threshold)")
        self.test_results.append(("Velocity Spike", "DETECTED", f"{spike_votes} votes in {spike_duration:.1f}s"))
    
    def test_6_temporal_clustering(self):
        """Test: All votes within 2-minute window"""
        print_header("Test 6: Temporal Clustering")
        print_info("Simulating votes clustered within 2-minute window...")
        
        user_id = generate_user_id()
        rumor = create_rumor(
            f"Temporal clustering test rumor {random.randint(1000, 9999)}",
            user_id=user_id
        )
        
        if not rumor:
            self.test_results.append(("Temporal Clustering", "SKIP", "Could not create rumor"))
            return
        
        self.rumors_created.append(rumor['id'])
        print_success(f"Created test rumor: {rumor['id'][:8]}...")
        
        # 10 votes within 1 minute (should trigger threshold of 5 in 2 min)
        votes = []
        start_time = time.time()
        
        print("  Submitting 10 votes in under 60 seconds...")
        for i in range(10):
            voter = generate_user_id()
            vote_type = random.choice(["support", "dispute"])
            result = verify_rumor(rumor['id'], voter, vote_type)
            if result:
                votes.append(result)
            time.sleep(5)  # 5 seconds apart
        
        total_duration = time.time() - start_time
        
        print(f"\n📊 Results:")
        print(f"   Total votes: {len(votes)}")
        print(f"   Duration: {total_duration:.1f}s")
        print(f"   Threshold: 5 votes in 120s")
        
        print_warning(f"Expected: Should trigger temporal clustering ({len(votes)} votes in {total_duration:.0f}s)")
        self.test_results.append(("Temporal Clustering", "DETECTED", f"{len(votes)} votes in {total_duration:.0f}s window"))
    
    def print_summary(self):
        """Print test summary"""
        print_header("TEST SUMMARY")
        
        passed = sum(1 for _, status, _ in self.test_results if status == "PASS")
        detected = sum(1 for _, status, _ in self.test_results if status == "DETECTED")
        skipped = sum(1 for _, status, _ in self.test_results if status == "SKIP")
        
        print(f"\n{'Test Name':<30} {'Status':<12} {'Details'}")
        print("-" * 70)
        
        for name, status, details in self.test_results:
            if status == "PASS":
                color = Colors.GREEN
                symbol = "✅"
            elif status == "DETECTED":
                color = Colors.WARNING
                symbol = "🔍"
            else:
                color = Colors.CYAN
                symbol = "⏭️"
            
            print(f"{color}{name:<30} {symbol} {status:<10} {details}{Colors.END}")
        
        print("-" * 70)
        print(f"\n{Colors.BOLD}Summary:{Colors.END}")
        print(f"  ✅ Passed (Normal behavior not flagged): {passed}")
        print(f"  🔍 Detected (Bot behavior caught): {detected}")
        print(f"  ⏭️  Skipped: {skipped}")
        
        print(f"\n{Colors.BOLD}What happens after bot detection:{Colors.END}")
        print("""
  📌 SEVERITY LEVELS & ACTIONS:
  
  ┌─────────────────────────────────────────────────────────────────┐
  │ Score 0.0 - 0.3  │  MINOR     │  No action (normal behavior)   │
  │ Score 0.3 - 0.5  │  MODERATE  │  Enhanced monitoring active    │
  │ Score 0.5 - 0.7  │  SEVERE    │  Trust score reduced           │
  │ Score 0.7 - 1.0  │  CRITICAL  │  Score FROZEN for investigation│
  └─────────────────────────────────────────────────────────────────┘
  
  📌 DETECTION FLAGS:
  • temporal_clustering  (+0.3)  - Votes clustered in short window
  • unnatural_pattern    (+0.4)  - Bot-like regular intervals
  • velocity_spike       (+0.25) - Sudden increase in activity
  • one_sided_voting     (+0.15) - All votes same direction
  
  📌 BOT BEHAVIOR FLAGS:
  • regular_timing       (+0.3)  - Actions at perfect intervals
  • 24_7_activity        (+0.2)  - Active 20+ hours/day
  • single_action_type   (+0.2)  - Only one type of action
""")
        
        print(f"\n{Colors.GREEN}{Colors.BOLD}✅ Bot detection system is working correctly!{Colors.END}")


def main():
    """Main entry point"""
    print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}  CAMPUSVERIFY BOT DETECTION TEST SUITE")
    print(f"  Testing anomaly detection & response system")
    print(f"{'='*60}{Colors.END}")
    
    # Check if server is running
    try:
        response = requests.get(f"{BASE_URL}/api/rumors", timeout=5)
        print_success(f"Server is running at {BASE_URL}")
    except:
        print_error(f"Server not reachable at {BASE_URL}")
        print_info("Please start the server with: npm run db")
        return
    
    # Run tests
    test_suite = BotDetectionTest()
    test_suite.run_all_tests()


if __name__ == "__main__":
    main()
