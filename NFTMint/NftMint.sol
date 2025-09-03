// SPDX-License-Identifier: MIT
pragma solidity ^0.8.1;

interface INftMint {
    function totalSupply() external  view returns (uint256);
    function mint(uint256 amount)external payable ;
    function transferFrom(address from,address to,uint256 tokenId)external ;
}

contract ERC721Mint{
    constructor(address ERC721,address owner)payable {
        uint256 t=INftMint(ERC721).totalSupply();
        INftMint(ERC721).mint{value:0.5 ether}(5);
        for(uint i=1;i<=5;i++){
            INftMint(ERC721).transferFrom(address(this),owner,t+i);
        }
        //自毁
        //selfdestruct(payable (owner));
    }
}

contract MintFactory{
    address owner;
    constructor(){
        owner=msg.sender;
    }
    //部署
    function deploy(address ERC721,uint256 count) public payable {
        for(uint256 i=0;i<count;i++){
            new ERC721Mint{value:0.05 ether}(ERC721,owner);
        }
    }
}