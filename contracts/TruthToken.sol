// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title TruthToken
 * @dev Campus Rumor Verification Token with staking and rewards
 */
contract TruthToken {
    string public constant name = "TruthToken";
    string public constant symbol = "TRUTH";
    uint8 public constant decimals = 18;
    
    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    
    // Staking
    mapping(address => uint256) public stakedBalance;
    mapping(bytes32 => Stake) public stakes;
    
    // Rumor lifecycle
    mapping(bytes32 => Rumor) public rumors;
    mapping(bytes32 => mapping(address => bool)) public hasVoted;
    
    // Admin
    address public admin;
    
    struct Stake {
        address staker;
        bytes32 rumorId;
        uint256 amount;
        bool isSupport;
        bool resolved;
    }
    
    struct Rumor {
        bytes32 contentHash;
        address submitter;
        uint256 stakeAmount;
        uint256 supportStake;
        uint256 disputeStake;
        uint8 status; // 0: active, 1: verified, 2: disputed, 3: expired
        uint256 createdAt;
        string ipfsCid;
    }
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Staked(address indexed user, bytes32 indexed rumorId, uint256 amount, bool isSupport);
    event RumorSubmitted(bytes32 indexed rumorId, address indexed submitter, uint256 stake);
    event RumorResolved(bytes32 indexed rumorId, uint8 status);
    event RewardsDistributed(bytes32 indexed rumorId, uint256 totalRewards);
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }
    
    constructor(uint256 initialSupply) {
        admin = msg.sender;
        _mint(msg.sender, initialSupply * 10**decimals);
    }
    
    // ============================================
    // ERC-20 Standard Functions
    // ============================================
    
    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }
    
    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }
    
    function transfer(address to, uint256 amount) public returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }
    
    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }
    
    function approve(address spender, uint256 amount) public returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= amount, "Insufficient allowance");
        _approve(from, msg.sender, currentAllowance - amount);
        _transfer(from, to, amount);
        return true;
    }
    
    // ============================================
    // Rumor & Staking Functions
    // ============================================
    
    /**
     * @dev Submit a new rumor with stake
     */
    function submitRumor(
        bytes32 contentHash,
        uint256 stakeAmount,
        string memory ipfsCid
    ) public returns (bytes32) {
        require(stakeAmount >= 5 * 10**decimals, "Min stake: 5 tokens");
        require(stakeAmount <= 50 * 10**decimals, "Max stake: 50 tokens");
        require(_balances[msg.sender] >= stakeAmount, "Insufficient balance");
        
        bytes32 rumorId = keccak256(abi.encodePacked(contentHash, msg.sender, block.timestamp));
        
        require(rumors[rumorId].createdAt == 0, "Rumor already exists");
        
        // Lock stake
        _transfer(msg.sender, address(this), stakeAmount);
        stakedBalance[msg.sender] += stakeAmount;
        
        rumors[rumorId] = Rumor({
            contentHash: contentHash,
            submitter: msg.sender,
            stakeAmount: stakeAmount,
            supportStake: 0,
            disputeStake: 0,
            status: 0,
            createdAt: block.timestamp,
            ipfsCid: ipfsCid
        });
        
        emit RumorSubmitted(rumorId, msg.sender, stakeAmount);
        
        return rumorId;
    }
    
    /**
     * @dev Stake on a rumor (verify or dispute)
     */
    function stakeOnRumor(
        bytes32 rumorId,
        uint256 amount,
        bool isSupport
    ) public returns (bytes32) {
        Rumor storage rumor = rumors[rumorId];
        require(rumor.createdAt > 0, "Rumor not found");
        require(rumor.status == 0, "Rumor already resolved");
        require(!hasVoted[rumorId][msg.sender], "Already voted");
        require(amount >= 2 * 10**decimals, "Min stake: 2 tokens");
        require(amount <= 20 * 10**decimals, "Max stake: 20 tokens");
        require(_balances[msg.sender] >= amount, "Insufficient balance");
        
        // Lock stake
        _transfer(msg.sender, address(this), amount);
        stakedBalance[msg.sender] += amount;
        
        // Create stake record
        bytes32 stakeId = keccak256(abi.encodePacked(rumorId, msg.sender, block.timestamp));
        stakes[stakeId] = Stake({
            staker: msg.sender,
            rumorId: rumorId,
            amount: amount,
            isSupport: isSupport,
            resolved: false
        });
        
        hasVoted[rumorId][msg.sender] = true;
        
        if (isSupport) {
            rumor.supportStake += amount;
        } else {
            rumor.disputeStake += amount;
        }
        
        emit Staked(msg.sender, rumorId, amount, isSupport);
        
        return stakeId;
    }
    
    /**
     * @dev Resolve a rumor and distribute rewards (oracle call)
     */
    function resolveRumor(bytes32 rumorId, bool verified) public onlyAdmin {
        Rumor storage rumor = rumors[rumorId];
        require(rumor.createdAt > 0, "Rumor not found");
        require(rumor.status == 0, "Already resolved");
        
        rumor.status = verified ? 1 : 2;
        
        emit RumorResolved(rumorId, rumor.status);
        
        // Distribute rewards
        _distributeRewards(rumorId, verified);
    }
    
    /**
     * @dev Internal reward distribution
     */
    function _distributeRewards(bytes32 rumorId, bool verified) internal {
        Rumor storage rumor = rumors[rumorId];
        
        uint256 winnerPool = verified ? rumor.supportStake : rumor.disputeStake;
        uint256 loserPool = verified ? rumor.disputeStake : rumor.supportStake;
        
        // For simplified distribution, winners get their stake back + proportional share of loser pool
        // Full implementation would iterate through all stakes
        
        // Return submitter stake
        if ((verified && rumor.stakeAmount > 0) || (!verified && rumor.disputeStake > rumor.supportStake)) {
            uint256 submitterReward = rumor.stakeAmount + (rumor.stakeAmount * loserPool / winnerPool / 2);
            _transfer(address(this), rumor.submitter, submitterReward);
            stakedBalance[rumor.submitter] -= rumor.stakeAmount;
        }
        
        emit RewardsDistributed(rumorId, winnerPool + loserPool);
    }
    
    // ============================================
    // Checkpoint Functions
    // ============================================
    
    /**
     * @dev Create immutable checkpoint hash
     */
    function createCheckpoint(
        bytes32 rumorId,
        uint256 trustScore,
        bytes32 stateHash
    ) public onlyAdmin returns (bytes32) {
        bytes32 checkpointHash = keccak256(abi.encodePacked(
            rumorId,
            trustScore,
            stateHash,
            block.timestamp,
            block.number
        ));
        
        return checkpointHash;
    }
    
    // ============================================
    // Internal Functions
    // ============================================
    
    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");
        require(_balances[from] >= amount, "Insufficient balance");
        
        _balances[from] -= amount;
        _balances[to] += amount;
        
        emit Transfer(from, to, amount);
    }
    
    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "Approve from zero address");
        require(spender != address(0), "Approve to zero address");
        
        _allowances[owner][spender] = amount;
        
        emit Approval(owner, spender, amount);
    }
    
    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "Mint to zero address");
        
        _totalSupply += amount;
        _balances[account] += amount;
        
        emit Transfer(address(0), account, amount);
    }
    
    // ============================================
    // Admin Functions
    // ============================================
    
    function mint(address to, uint256 amount) public onlyAdmin {
        _mint(to, amount);
    }
    
    function setAdmin(address newAdmin) public onlyAdmin {
        admin = newAdmin;
    }
}
