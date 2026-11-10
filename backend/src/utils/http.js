export const asyncHandler=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
export const clean=(v,max=255)=>String(v??'').trim().slice(0,max);
export const fileUrl=(req,name)=>name?`${process.env.PUBLIC_URL||`${req.protocol}://${req.get('host')}`}/uploads/${name}`:null;
