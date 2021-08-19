pragma solidity ^0.4.24;
// pragma experimental ABIEncoderV2;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    uint256 private constant AIRLINE_MINIMUM_FEE = 10 ether;

    bool private operational = true; // Blocks all state changes throughout the contract if false
    address private contractOwner; // Account used to deploy contract
    mapping(address => bool) private authorizedContracts;

    struct Airline {
        string name;
        bool isRegistered;
        bool isFunded;
        uint256 balance;
    }

    struct Flight {
        bytes32 number;
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;
        address airline;
    }

    struct Insurance {
        address client;
        uint256 value;
        bool isPayed;
        uint256 balance;
    }

    mapping(address => Airline) private airlines;
    mapping(bytes32 => Flight) private flights;
    mapping(bytes32 => Insurance) private insurances;
    uint256 private airlinesRegistered = 0;
    bytes32[] private flightsRegistered;
    mapping(bytes32 => bytes32[]) private flightInsurances;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Constructor
     *      The deploying account becomes contractOwner
     */
    constructor(string _airlineName) public {
        contractOwner = msg.sender;
        airlines[msg.sender] = Airline(_airlineName, true, false, 0);
        airlinesRegistered = airlinesRegistered.add(1);
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
        require(operational, "Data Contract is currently not operational");

        _; // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
     * @dev Modifier that requires the "ContractOwner" account to be the function caller
     */
    modifier requireContractOwner() {
        require(
            msg.sender == contractOwner,
            "Data Contract Caller is not the contract owner"
        );

        _;
    }

    /**
     * @dev Modifier that requires the caller to be an authorized contract
     */
    modifier requireIsAuthorized() {
        require(
            authorizedContracts[msg.sender] == true,
            "Data Contract Caller is not authorized"
        );

        _;
    }

    modifier requireIsAdministrator() {
        require(
            msg.sender == contractOwner ||
                authorizedContracts[msg.sender] == true,
            "Data Contract Caller is not the contract owner or authorized"
        );

        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Get operating status of contract
     *
     * @return A bool that is the current operating status
     */
    function isOperational()
        external
        view
        requireIsAdministrator
        returns (bool)
    {
        return operational;
    }

    /**
     * @dev Sets contract operations on/off
     *
     * When operational mode is disabled, all write transactions except for this one will fail
     */
    function setOperatingStatus(bool _mode) external requireIsAdministrator {
        operational = _mode;
    }

    function authorizeContract(address _contractAddress)
        external
        requireIsOperational
    {
        authorizedContracts[_contractAddress] = true;
    }

    function deauthorizeContract(address _contractAddress)
        external
        requireIsOperational
    {
        delete authorizedContracts[_contractAddress];
    }

    function getAirlinesRegistered()
        external
        view
        requireIsOperational
        requireIsAuthorized
        returns (uint256)
    {
        return airlinesRegistered;
    }

    function getAirline(address _airlineAddress)
        external
        view
        requireIsOperational
        requireIsAuthorized
        returns (
            string,
            bool,
            bool,
            uint256
        )
    {
        Airline memory _airline = airlines[_airlineAddress];

        // string memory _name = airlines[_airlineAddress].name;
        // bool _isRegistered = airlines[_airlineAddress].isRegistered;
        // bool _isFunded = airlines[_airlineAddress].isFunded;
        // uint256 _balance = airlines[_airlineAddress].balance;

        return (
            _airline.name,
            _airline.isRegistered,
            _airline.isFunded,
            _airline.balance
        );
    }

    function getFlightsRegistered()
        external
        view
        requireIsOperational
        requireIsAuthorized
        returns (bytes32[])
    {
        return flightsRegistered;
    }

    function getFlightInsurances(bytes32 _flightKey)
        external
        view
        requireIsOperational
        requireIsAuthorized
        returns (bytes32[])
    {
        return flightInsurances[_flightKey];
    }

    function getFlight(bytes32 _flightNumber)
        external
        view
        requireIsOperational
        requireIsAuthorized
        returns (
            bool,
            uint8,
            uint256,
            address,
            bytes32
        )
    {
        Flight storage _flight = flights[bytes32(0)];
        bytes32 _flightKey = bytes32(0);

        for (uint8 index = 0; index < flightsRegistered.length; index++) {
            // bytes32 _key = getKeyEncoded(
            //     _flight.airline,
            //     bytes32ToString(_flightNumber),
            //     _flight.updatedTimestamp
            // );

            if (flights[flightsRegistered[index]].number == _flightNumber) {
                return (
                    flights[flightsRegistered[index]].isRegistered,
                    flights[flightsRegistered[index]].statusCode,
                    flights[flightsRegistered[index]].updatedTimestamp,
                    flights[flightsRegistered[index]].airline,
                    flightsRegistered[index]
                );
            }
        }

        return (
            _flight.isRegistered,
            _flight.statusCode,
            _flight.updatedTimestamp,
            _flight.airline,
            _flightKey
        );
    }

    function getInsurance(bytes32 _insuranceKey)
        external
        view
        requireIsOperational
        requireIsAuthorized
        returns (
            address,
            uint256,
            bool,
            uint256
        )
    {
        Insurance memory _insurance = insurances[_insuranceKey];

        return (
            _insurance.client,
            _insurance.value,
            _insurance.isPayed,
            _insurance.balance
        );
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
     *      Can only be called from FlightSuretyApp contract
     *
     */
    function registerAirline(address _airlineAddress, string _airlineName)
        external
        requireIsOperational
        requireIsAuthorized
    {
        airlines[_airlineAddress] = Airline(_airlineName, true, false, 0);
        airlinesRegistered = airlinesRegistered.add(1);
    }

    function fundAirline(address _airlineAddress, uint256 _airlineAmount)
        external
        payable
        requireIsOperational
        requireIsAuthorized
    {
        airlines[_airlineAddress].isFunded = true;
        airlines[_airlineAddress].balance = airlines[_airlineAddress]
            .balance
            .add(_airlineAmount);
    }

    function getKeyEncoded(
        address _address,
        bytes32 _key,
        uint256 _value
    ) private view requireIsOperational returns (bytes32) {
        return keccak256(abi.encodePacked(_address, _key, _value));
    }

    function registerFlight(
        bytes32 _flightNumber,
        uint8 _flightStatus,
        uint256 _flightTime,
        address _airlineAddress
    ) external requireIsOperational requireIsAuthorized {
        // string memory _number = bytes32ToString(_flightNumber);
        bytes32 _flightKey = getKeyEncoded(
            _airlineAddress,
            _flightNumber,
            _flightTime
        );
        flights[_flightKey] = Flight(
            _flightNumber,
            true,
            _flightStatus,
            _flightTime,
            _airlineAddress
        );
        flightsRegistered.push(_flightKey);
    }

    /**
     * @dev Buy insurance for a flight
     *
     */
    function buyInsurance(
        bytes32 _flightKey,
        address _clientAddress,
        uint256 _clientAmount
    ) external payable requireIsOperational requireIsAuthorized {
        // msg.sender.transfer(1 wei);
        bytes32 _insuranceKey = getKeyEncoded(_clientAddress, _flightKey, 0);

        insurances[_insuranceKey] = Insurance(
            _clientAddress,
            _clientAmount,
            false,
            0
        );
        flightInsurances[_flightKey].push(_insuranceKey);

        // fund airline
        address _airlineAddress = flights[_flightKey].airline;
        airlines[_airlineAddress].isFunded = true;
        airlines[_airlineAddress].balance = airlines[_airlineAddress]
            .balance
            .add(_clientAmount);
    }

    /**
     *  @dev Credits payouts to insurees
     */
    function creditInsurees(
        bytes32 _flightKey,
        address _clientAddress,
        uint256 _value
    ) private requireIsOperational requireIsAuthorized {
        bytes32 _insuranceKey = getKeyEncoded(_clientAddress, _flightKey, 0);
        insurances[_insuranceKey].balance = insurances[_insuranceKey]
            .balance
            .add(_value);
        insurances[_insuranceKey].isPayed = true;
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
     */
    function pay() external pure {}

    /**
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
     *      resulting in insurance payouts, the contract should be self-sustaining
     *
     */
    function fund() public payable {
        // msg.sender.transfer(1 wei);
    }

    // function bytes32ToString(bytes32 x)
    //     private
    //     view
    //     requireIsOperational
    //     returns (string)
    // {
    //     bytes memory bytesString = new bytes(32);
    //     uint256 charCount = 0;
    //     for (uint256 j = 0; j < 32; j++) {
    //         bytes1 char = bytes1(bytes32(uint256(x) * 2**(8 * j)));
    //         if (char != 0) {
    //             bytesString[charCount] = char;
    //             charCount++;
    //         }
    //     }
    //     bytes memory bytesStringTrimmed = new bytes(charCount);
    //     for (j = 0; j < charCount; j++) {
    //         bytesStringTrimmed[j] = bytesString[j];
    //     }
    //     return string(bytesStringTrimmed);
    // }

    function setFlightStatus(bytes32 _flightKey, uint8 _statusCode)
        external
        requireIsOperational
        requireIsAuthorized
    {
        flights[_flightKey].statusCode = _statusCode;
    }

    /**
     * @dev Fallback function for funding smart contract.
     *
     */
    function() external payable {
        fund();
    }
}
