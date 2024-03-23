const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err))
    }

}
export { asyncHandler }

// anotherway and little bit easy but above example are clean 

// const asyncHandler = () => {}
// const asyncHandler = (func) => () => {}
// const asyncHandler = (func) => async () => {}

// const asyncHandlers = (fn) = async(req, res, next) = {
//     try { await fn(req, res, next)} 
//     catch(err) {
//         res.status(err.code || 500).json({
//             success: false,
//             message: err.message
//         })

//     }
// }