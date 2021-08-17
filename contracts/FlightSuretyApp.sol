pragma solidity ^0.4.24;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;
        address airline;
    }
    mapping(bytes32 => Flight) private flights;

    FlightSuretyData flightSuretyData;

    uint256 private constant AIRLINE_CONSENSUS = 4;
    uint256 private constant AIRLINE_CONSENSUS_VOTES = 50; // percentage %
    uint256 private constant AIRLINE_MINIMUM_FEE = 10 ether;

    address private contractOwner;
    mapping(address => address[]) private airlineVotes;

    event AirlineRegistered(address airlineAddress);
    event AirlineFunded(address airlineAddress, uint256 airlineValue);

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
     * @dev Contract constructor
     *
     */
    constructor(address _flightSuretyDataAddress) public {
        contractOwner = msg.sender;
        flightSuretyData = FlightSuretyData(_flightSuretyDataAddress);
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
     * @dev Modifier that requires the "operational" boolean variable to be "true"
     *      This is used on all state changing functions to pause the contract in
     *      the event there is an issue that needs to be fixed
     */
    modifier requireIsOperational() {
        // Modify to call data contract's status
        require(
            flightSuretyData.isOperational(),
            "App Contract is currently not operational"
        );

        _; // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
     * @dev Modifier that requires the "ContractOwner" account to be the function caller
     */
    modifier requireContractOwner() {
        require(
            msg.sender == contractOwner,
            "App Contract Caller is not the contract owner"
        );

        _;
    }

    modifier requireValidAddress(address _address) {
        require(_address != address(0x0), "Address is not valid");

        _;
    }

    // Only existing airline may register a new airline until there are at least four airlines registered
    modifier requireValidAirlineCaller() {
        bool _isRegistered;

        (, _isRegistered, , ) = flightSuretyData.getAirline(msg.sender);
        require(
            _isRegistered,
            "App Contract Caller is not an existing registered airline"
        );

        _;
    }

    modifier requireUnregisteredAirline(address _airlineAddress) {
        bool _isRegistered;

        (, _isRegistered, , ) = flightSuretyData.getAirline(_airlineAddress);
        require(!_isRegistered, "Airline is already registered");

        _;
    }

    modifier requireMinimumFee(uint256 _fee) {
        require(msg.value >= _fee, "Insufficient amount to fund airline");

        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() public view returns (bool) {
        return flightSuretyData.isOperational(); // Modify to call data contract's status
    }

    function setOperatingStatus(bool _mode) external requireContractOwner {
        require(
            flightSuretyData.isOperational() != _mode,
            "New mode must be different from existing mode"
        );

        flightSuretyData.setOperatingStatus(_mode);
    }

    function getAirlineVotes(address _airlineAddress)
        public
        view
        returns (address[])
    {
        return airlineVotes[_airlineAddress];
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    function voteForAirline(address _airlineAddress) private {
        bool isDuplicateVote = false;

        for (
            uint256 index = 0;
            index < airlineVotes[_airlineAddress].length;
            index++
        ) {
            // check if current caller already voted for the incoming airline
            if (airlineVotes[_airlineAddress][index] == msg.sender) {
                isDuplicateVote = true;
                break;
            }
        }

        require(
            !isDuplicateVote,
            "App Contract Caller has already voted for this airline"
        );

        // insert vote from current caller for the incoming airline and airline's votes itself
        if (!isDuplicateVote) {
            airlineVotes[_airlineAddress].push(msg.sender);
        }
    }

    /**
     * @dev Add an airline to the registration queue
     *
     */
    function registerAirline(address _airlineAddress, string _airlineName)
        external
        requireIsOperational
        requireValidAddress(_airlineAddress)
        requireValidAirlineCaller
        requireUnregisteredAirline(_airlineAddress)
    {
        uint256 _airlinesRegistered = flightSuretyData.getAirlinesRegistered();

        if (AIRLINE_CONSENSUS > _airlinesRegistered) {
            flightSuretyData.registerAirline(_airlineAddress, _airlineName);

            emit AirlineRegistered(_airlineAddress);
        } else {
            // Registration of fifth and subsequent airlines requires multi-party consensus of 50% of registered airlines
            voteForAirline(_airlineAddress);

            // check if airline's votes are greater than or equal to 50% of registered airlines
            uint256 _registered = _airlinesRegistered
                .mul(AIRLINE_CONSENSUS_VOTES)
                .div(100);

            if (airlineVotes[_airlineAddress].length >= _registered) {
                flightSuretyData.registerAirline(_airlineAddress, _airlineName);

                emit AirlineRegistered(_airlineAddress);
            }
        }
    }

    function fundAirline()
        external
        payable
        requireIsOperational
        requireValidAddress(msg.sender)
        requireValidAirlineCaller
        requireMinimumFee(AIRLINE_MINIMUM_FEE)
    {
        // address payable dataContractAddress = address(uint160(address(flightSuretyData)));
        address(flightSuretyData).transfer(msg.value);

        flightSuretyData.fundAirline(msg.sender, msg.value);

        emit AirlineFunded(msg.sender, msg.value);
    }

    /**
     * @dev Register a future flight for insuring.
     *
     */
    function registerFlight() external pure {}

    /**
     * @dev Called after oracle has updated flight status
     *
     */
    // function processFlightStatus(
    //     address airline,
    //     string memory flight,
    //     uint256 timestamp,
    //     uint8 statusCode
    // ) internal pure {}

    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus(
        address airline,
        string flight,
        uint256 timestamp
    ) external {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(
            abi.encodePacked(index, airline, flight, timestamp)
        );
        oracleResponses[key] = ResponseInfo({
            requester: msg.sender,
            isOpen: true
        });

        emit OracleRequest(index, airline, flight, timestamp);
    }

    // region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;

    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester; // Account that requested status
        bool isOpen; // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses; // Mapping key is the status code reported
        // This lets us group responses and identify
        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(
        address airline,
        string flight,
        uint256 timestamp,
        uint8 status
    );

    event OracleReport(
        address airline,
        string flight,
        uint256 timestamp,
        uint8 status
    );

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(
        uint8 index,
        address airline,
        string flight,
        uint256 timestamp
    );

    // Register an oracle with the contract
    function registerOracle() external payable {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({isRegistered: true, indexes: indexes});
    }

    function getMyIndexes() external view returns (uint8[3]) {
        require(
            oracles[msg.sender].isRegistered,
            "Not registered as an oracle"
        );

        return oracles[msg.sender].indexes;
    }

    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse(
        uint8 index,
        address airline,
        string flight,
        uint256 timestamp,
        uint8 statusCode
    ) external {
        require(
            (oracles[msg.sender].indexes[0] == index) ||
                (oracles[msg.sender].indexes[1] == index) ||
                (oracles[msg.sender].indexes[2] == index),
            "Index does not match oracle request"
        );

        bytes32 key = keccak256(
            abi.encodePacked(index, airline, flight, timestamp)
        );
        require(
            oracleResponses[key].isOpen,
            "Flight or timestamp do not match oracle request"
        );

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (
            oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES
        ) {
            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Handle flight status as appropriate
            // processFlightStatus(airline, flight, timestamp, statusCode);
        }
    }

    function getFlightKey(
        address airline,
        string flight,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account) internal returns (uint8[3]) {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);

        indexes[1] = indexes[0];
        while (indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while ((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex(address account) internal returns (uint8) {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(
            uint256(
                keccak256(
                    abi.encodePacked(blockhash(block.number - nonce++), account)
                )
            ) % maxValue
        );

        if (nonce > 250) {
            nonce = 0; // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

    // endregion
}

contract FlightSuretyData {
    function isOperational() external view returns (bool);

    function setOperatingStatus(bool mode) external;

    function getAirlinesRegistered() external view returns (uint256);

    function getAirline(address _airlineAddress)
        external
        view
        returns (
            string,
            bool,
            bool,
            uint256
        );

    function registerAirline(address _airlineAddress, string _airlineName)
        external;

    function fundAirline(address _airlineAddress, uint256 _airlineAmount)
        external
        payable;
}
