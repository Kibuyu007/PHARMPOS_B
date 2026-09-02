import grnCounter from "../../Models/Manunuzi/grnCounter";


export const getNextGrnNumber = async () => {
  const counter = await grnCounterrnCounter.findOneAndUpdate(
    { name: "grnNumber" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};