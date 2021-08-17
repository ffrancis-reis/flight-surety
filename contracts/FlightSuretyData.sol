pragma solidity ^0.4.24;

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

    mapping(address => Airline) private airlines;
    uint256 private airlinesRegistered = 0;

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
        string memory _name = airlines[_airlineAddress].name;
        bool _isRegistered = airlines[_airlineAddress].isRegistered;
        bool _isFunded = airlines[_airlineAddress].isFunded;
        uint256 _balance = airlines[_airlineAddress].balance;

        // Airline storage airline = airlines[_address];
        // return (airline.name, airline.isRegistered, airline.isVerified);

        return (_name, _isRegistered, _isFunded, _balance);
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

    /**
     * @dev Buy insurance for a flight
     *
     */
    function buy() external payable {
        msg.sender.transfer(1 wei);
    }

    /**
     *  @dev Credits payouts to insurees
     */
    function creditInsurees() external pure {}

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
     */
    function pay() external pure {}

    function fund(address _airlineAddress, uint256 _airlineAmount) private {
        // msg.sender.transfer(1 wei);

        airlines[_airlineAddress].isFunded = true;
        airlines[_airlineAddress].balance = airlines[_airlineAddress]
            .balance
            .add(_airlineAmount);
    }

    /**
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
     *      resulting in insurance payouts, the contract should be self-sustaining
     *
     */
    function fundAirline(address _airlineAddress, uint256 _airlineAmount)
        external
        payable
        requireIsOperational
        requireIsAuthorized
    {
        fund(_airlineAddress, _airlineAmount);
    }

    function getFlightKey(
        address airline,
        string memory flight,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
     * @dev Fallback function for funding smart contract.
     *
     */
    function() external payable {
        // for (uint256 index = 0; index < airlinesRegistered.length; index++) {
        //     address _airlineAddress = airlinesRegistered[index];
        //     fund(_airlineAddress, AIRLINE_MINIMUM_FEE);
        // }
    }
}
