import express from 'express'
import { addCustomer, customerStatus, getAllCustomers, getCustomers, searchCustomer, updateCustomer } from '../../Controlers/Customer/customer.js'
import { depozit, getCurrentBalance, getCustomerReport, payBill, withDraw } from '../../Controlers/Customer/wallet.js'




const router = express.Router()



router.post('/addCustomer', addCustomer) 
router.get('/getCustomers', getCustomers)
router.get('/getAllCustomers', getAllCustomers)
router.put('/updateCustomer/:id',updateCustomer)
router.get('/searchCustomer', searchCustomer)
router.put('/status/:id',customerStatus)
router.post('/deposit', depozit);
router.post('/withdraw', withDraw);
router.get('/currentBalance/:id', getCurrentBalance);
router.get("/customerReport/:id", getCustomerReport);
router.post("/payBill", payBill);




export default router