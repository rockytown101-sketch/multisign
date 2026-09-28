const TronWeb = require('tronweb');

class TronMultiSigService {
  constructor(nodeUrl = 'https://api.trongrid.io') {
    this.tronWeb = new TronWeb({ fullHost: nodeUrl });
  }

  /**
   * 构建标准的波场账户多签权限更新交易体 (AccountPermissionUpdate)
   * @param {string} ownerAddress 被修改权限的目标钱包 C
   * @param {Array<string>} signerAddresses 控制人 A 和 B 的地址列表
   * @param {number} threshold 签名阈值 (如 2 代表必须两人同时签名)
   */
  async buildPermissionUpdateTx(ownerAddress, signerAddresses, threshold = 2) {
    try {
      if (!this.tronWeb.isAddress(ownerAddress)) {
        throw new Error('无效的目标钱包地址');
      }

      // 组装 Keys 签名者权重列表
      const keys = signerAddresses.map(addr => {
        if (!this.tronWeb.isAddress(addr)) {
          throw new Error(`无效的控制人地址: ${addr}`);
        }
        return {
          address: this.tronWeb.address.toHex(addr),
          weight: 1
        };
      });

      // 1. Owner 权限结构
      const ownerPermission = {
        type: 0,
        permission_name: 'owner',
        threshold: threshold,
        keys: keys
      };

      // 2. Active 权限结构 (赋予常用操作权限掩码)
      const activePermissions = [{
        type: 2,
        permission_name: 'active',
        threshold: threshold,
        operations: '7fff1fc0037e0000000000000000000000000000000000000000000000000000',
        keys: keys
      }];

      // 构建修改权限交易体
      const transaction = await this.tronWeb.transactionBuilder.updateAccountPermissions(
        ownerAddress,
        ownerPermission,
        null,
        activePermissions
      );

      return {
        success: true,
        transaction
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 构建附带通知 Memo 的微额转账交易 (发送通知待办)
   */
  async buildNotificationTx(fromAddress, toAddress, memoText, amountSun = 10) {
    try {
      // 构建转账交易
      let tx = await this.tronWeb.transactionBuilder.sendTrx(
        toAddress,
        amountSun,
        fromAddress
      );

      // 将通知 Memo 写入交易数据
      tx = await this.tronWeb.transactionBuilder.addUpdateData(tx, memoText, 'utf8');

      return {
        success: true,
        transaction: tx
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = TronMultiSigService;
