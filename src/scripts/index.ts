import { TransactionService } from "../modules/transaction/transaction.service";

export const initScheduler = () => {
  const service = new TransactionService();

  // tiap 60 detik cek transaksi overdue
  setInterval(async () => {
    try {
      const expired = await service.autoExpire();
      const canceled = await service.autoCancel();

      if (expired.expired || canceled.canceled) {
        console.log("[scheduler]", { ...expired, ...canceled });
      }
    } catch (e) {
      console.error("[scheduler] error:", e);
    }
  }, 60 * 1000);
};
