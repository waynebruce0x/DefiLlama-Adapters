// Fixes Inscription Protocol - Staking Pool: https://fixes.world/
const { callCadence } = require("../helper/chain/flow");

let queryTVLCode = `
import FRC20Staking from 0xd2abb5dbf5e08666
import FRC20AccountsPool from 0xd2abb5dbf5e08666
import FRC20Marketplace from 0xd2abb5dbf5e08666
import FRC20Storefront from 0xd2abb5dbf5e08666
import FRC20Indexer from 0xd2abb5dbf5e08666

access(all)
fun main(): UFix64 {
    let acctsPool = FRC20AccountsPool.borrowAccountsPool()
    let stakingTokens = acctsPool.getAddresses(type: FRC20AccountsPool.ChildAccountType.Staking)

    var totalTVL = 0.0
    let ticks = stakingTokens.keys

    for tick in ticks {
        let stakingAddr = stakingTokens[tick]!
        let stakingPool = FRC20Staking.borrowPool(stakingAddr)
        if stakingPool == nil {
            continue
        }

        let indexer = FRC20Indexer.getIndexer()
        // calculate floor price
        let benchmarkPrice = indexer.getBenchmarkValue(tick: tick)
        var floorPrice = benchmarkPrice

        if let marketAddr = acctsPool.getFRC20MarketAddress(tick: tick) {
            if let market = FRC20Marketplace.borrowMarket(marketAddr) {
                let buyPriceRanks = market.getPriceRanks(type: FRC20Storefront.ListingType.FixedPriceBuyNow)
                if buyPriceRanks.length > 0 {
                    var i = 0
                    let floorPriceRank = buyPriceRanks[i]
                    let listIds = market.getListedIds(type: FRC20Storefront.ListingType.FixedPriceBuyNow, rank: floorPriceRank)
                    if listIds.length > 0 {
                        if let listing = market.getListedItem(
                            type: FRC20Storefront.ListingType.FixedPriceBuyNow,
                            rank: floorPriceRank,
                            id: listIds[0]
                        ) {
                            if let details = listing.getDetails() {
                                floorPrice = details.pricePerToken()
                            }
                        }
                    }
                }
            }
        } // end if

        var details = stakingPool!.getDetails()
        let validStaked = details.totalStaked - details.totalUnstakingLocked

        totalTVL = totalTVL + (validStaked * (floorPrice - benchmarkPrice))
    }
    return totalTVL
}
`;

async function tvl() {
  try {
    const flowTokenTVL = await callCadence(queryTVLCode, true);
    return { flow: flowTokenTVL };
  } catch (error) {
    throw new Error(
      "Couln't query scripts of fixes 𝔉rc20 treasury pool",
      error
    );
  }
}

module.exports = {
  timetravel: false,
  methodology:
    "Counting the 𝔉rc20 tokens staked by users in the Fixes inscription protocol, and tokens locked by unstaking are not counted.",
  flow: {
    tvl,
  },
};
