const { expect } = require("chai");
const hre = require("hardhat");
const { utils } = require("ethers");

describe("MarketPlace", () => {
    let deployer, seller1, seller2, buyer1, buyer2;
    let ERC1155A, ERC1155B, MarketPlace;

    beforeEach(async () => {
        [ deployer, seller1, seller2, buyer1, buyer2] = await hre.ethers.getSigners();
        
        // create 2 ERC1155 token contracts
        const FreeERC1155Factory = await hre.ethers.getContractFactory("FreeERC1155", deployer);
        ERC1155A = await FreeERC1155Factory.deploy();
        ERC1155B = await FreeERC1155Factory.deploy();
        
        // mint some ERC1155 for users
        await ERC1155A.mint(seller1.address, 0, 10);
        await ERC1155A.mint(seller2.address, 0, 10);
        await ERC1155B.mint(seller1.address, 1, 10);
        await ERC1155B.mint(seller2.address, 2, 10);

        // deploy the market place
        const MarketPlaceFactory = await hre.ethers.getContractFactory("MarketPlace", deployer);
        MarketPlace = await MarketPlaceFactory.deploy();


        // approve so the market place can move ERC1155 from seller's account
        await ERC1155A.connect(seller1).setApprovalForAll(MarketPlace.address, true);
        await ERC1155A.connect(seller2).setApprovalForAll(MarketPlace.address, true);
        await ERC1155B.connect(seller1).setApprovalForAll(MarketPlace.address, true);
        await ERC1155B.connect(seller2).setApprovalForAll(MarketPlace.address, true);
    });

    it('cannot list/remove/buy with amount 0', async () => {
        let id = 0;
        let amount = 2;
        let price = 100;

        await expect(MarketPlace.connect(seller1).listItem(ERC1155A.address, id, 0, price))
            .to.be.revertedWith("MarketPlace: nothing to list.");
        
        await MarketPlace.connect(seller1).listItem(ERC1155A.address, id, amount, price);

        await expect(MarketPlace.connect(seller1).removeItem(ERC1155A.address, id, 0))
            .to.be.revertedWith("MarketPlace: nothing to remove.");

        await expect(MarketPlace.connect(buyer1).buyItem(seller1.address, ERC1155A.address, id, 0, {value: 1000}))
            .to.be.revertedWith("MarketPlace: nothing to buy.");
    });

    it('can list/remove/buy item', async () => {
        let id = 0;
        let amount = 6;
        let price = 100;

        let sellerBalanceBefore = await ERC1155A.balanceOf(seller1.address, id);
        let marketPlaceBalanceBefore = await ERC1155A.balanceOf(MarketPlace.address, id);

        // We expect two events here, one in the MarketPlace one in the ERC1155
        await expect(MarketPlace.connect(seller1).listItem(ERC1155A.address, id, amount, price))
            .to.emit(MarketPlace, "ListItem").withArgs(seller1.address, ERC1155A.address, id, amount, price)
            .to.emit(ERC1155A, "TransferSingle").withArgs(MarketPlace.address, seller1.address, MarketPlace.address, id, amount);

        let sellerBalanceAfter = await ERC1155A.balanceOf(seller1.address, id);
        let marketPlaceBalanceAfter = await ERC1155A.balanceOf(MarketPlace.address, id);

        // We check that the ERC1155 balances are correct
        expect(sellerBalanceAfter).to.be.equal(sellerBalanceBefore - amount);
        expect(marketPlaceBalanceAfter).to.be.equal(marketPlaceBalanceBefore + amount);
        
        // We also check that the inventory mapping in the market place is properly updated
        let item = await MarketPlace.checkItem(seller1.address, ERC1155A.address, id);
        expect(item[0]).to.be.equal(amount);
        expect(item[1]).to.be.equal(price);

        // We cannot list when the outstanding amount is non-zero
        await expect(MarketPlace.connect(seller1).listItem(ERC1155A.address, id, 1, price))
            .to.be.revertedWith("MarketPlace: cancel existing listing first.");

        // seller1 cannot remove more than he has listed
        await expect(MarketPlace.connect(seller1).removeItem(ERC1155A.address, id, amount+1))
            .to.be.revertedWith("MarketPlace: not enough to remove.");

        // seller2 cannot remove seller1's items
        try {
            await MarketPlace.connect(seller2).removeItem(ERC1155A.address, id, 1);
        } catch (error) {}
        
        // the amount listed for seller1 is still the same
        item = await MarketPlace.checkItem(seller1.address, ERC1155A.address, id);
        expect(item[0]).to.be.equal(amount);

        // seller1 can remove his item
        await expect(MarketPlace.connect(seller1).removeItem(ERC1155A.address, id, 1))
            .to.emit(MarketPlace, "RemoveItem").withArgs(seller1.address, ERC1155A.address, id, 1)
            .to.emit(ERC1155A, "TransferSingle").withArgs(MarketPlace.address, MarketPlace.address, seller1.address, id, 1);

        let sellerBalanceAfterRemoval = await ERC1155A.balanceOf(seller1.address, id);
        let marketPlaceBalanceAfterRemoval = await ERC1155A.balanceOf(MarketPlace.address, id);

        expect(sellerBalanceAfterRemoval).to.be.equal(sellerBalanceAfter.add(1));
        expect(marketPlaceBalanceAfterRemoval).to.be.equal(marketPlaceBalanceAfter.sub(1));

        // buyer can buy from seller1
        let amountToBuy = 2
        let totalPrice = amountToBuy * price

        /* await expect(MarketPlace.connect(seller1).removeItem(ERC1155A.address, id, 1))
            .to.emit(MarketPlace, "RemoveItem").withArgs(seller1.address, ERC1155A.address, id, 1)
            .to.emit(ERC1155A, "TransferSingle").withArgs(MarketPlace.address, MarketPlace.address, seller1.address, id, 1); */
    });

});