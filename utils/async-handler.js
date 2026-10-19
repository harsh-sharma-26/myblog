// [FIX #1 - Async errors] Express 4 async route ke andar aaye error ko khud nahi pakadta,
// to DB fail hone pe request hang ho jati thi. Ye chhota helper har route / middleware ko wrap karta hai:
// agar andar koi error aaye to wo `next(error)` ko chala deta hai, aur app.js ka
// error handler 500 page dikha deta hai. Ab har route me alag try/catch likhne ki zarurat nahi.
//
// (Pehle ye routes/blog.js ke andar tha. Ab auth routes aur middleware bhi ise use karte hain,
//  isliye alag file me nikal diya taaki sab jagah same helper import ho.)
function asyncHandler(routeFunction) {
  return function (req, res, next) {
    Promise.resolve(routeFunction(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
