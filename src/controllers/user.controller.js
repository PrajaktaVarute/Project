import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js'
import {User} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudnary.js'
import { ApiResponse } from '../utils/ApiResponse.js';

const generateAccessAndRefreshToken = async(userId)=>{
    try{
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
       await user.save({validateBeforeSave: false})
       return {accessToken,refreshToken};
    }catch{
        throw new ApiError(500,"Something went wrong while generating refresh and acess token");
    }
}

const registerUser = asyncHandler(async (req , res )=>{
    // get user details from frontend
    //validation -not empty
    //check if user already exists : username,email
    //upload them to cloudinary,avtar
    //create user object - create entry in db
    //remove passord and refresh token from response
    //return res


   const {fullname, email,username,password} =req.body;
   console.log(req.body);
   console.log("email:",email);
   if(
    [fullname,email,username,password].some((field)=>
    field?.trim() === "")
   ){
    throw new ApiError(400,"All fields are required")
   }  
   

   const existedUser = await User.findOne({
    $or : [{username} , { email }]
   })
   if(existedUser){
    throw new ApiError(409,"User with email or username already exists")
   }

   //console.log(req.files);
   const avatarLocalPath = req.files?.avatar[0]?.path;
//    const  coverImageLocalPath  = req.files?.coverImage[0]?.path;

   let coverImageLocalPath;
   if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0)
   {
        coverImageLocalPath = req.files.coverImage[0].path;
   }
   if(!avatarLocalPath){
    throw new ApiError(400,"Avatar file is required");
   }
    const  avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!avatar){
        throw new ApiError(400,"Avatar file is required")
    }


    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username : username.toLowerCase()
    })

   const createdUser =  await User.findById(user._id).select(
    "-password -refreshToken"
   )
   if(!createdUser){
    throw new ApiError(400,"Something went wrong while registering the user" )
   }

   return res.status(201).json(
    new ApiResponse(200,createdUser,"User registered Successlly")
   )


})
const loginUser = asyncHandler(async (req,res)=>{
    //req body -> data
    //username or email
    //find the user
    //password check
    //access and refresh token
    //send these tokens in secure cookies 
    const {email,username,password} = req.body;
    if(!username || !email){
        throw new ApiError(400,"username or email is required")

    }

    const user = await User.findOne({
        $or: [{username},{email}]
    })

    if(!user){
        throw new ApiError(404, "User does not exists")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credentials");
    }
    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true,
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken,
                refreshToken
            },
            "User logged In successfully"
        )
    )
})

const logoutUser = asyncHandler(async(req,res)=>{
    await User.findByIDAndUpdate(req.user._id,
        {
            $set:
            {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: true,
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{} ,"User logged out successfully"));
})
export {
    registerUser,
    loginUser,
    logoutUser,
};