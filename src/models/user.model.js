import mongoose ,{Schema} from "mongoose";

const userSchema = new Schema ({
    username:{
        type : String,
        required: true,
        trim:true,
        lowercase: true,
        index:true,
        unique:true
    },
    email:{
        type : String,
        required: true,
        trim:true,
        lowercase: true,
        unique:true
    },
    fullName:{
        type : String,
        required: true,
        trim:true,
        lowercase: true,
        index:true
    },
    avatar:{
        type:String, //cloudniary image url
        required:true,
    },
    coverImage:{
        type:String, 
    },
    watchHistory:[
        { type: Schema.Types.ObjectId,
            ref:"Video"
        }
    ]
    

},{timestamps:true})

export const User = mongoose.model("User",userSchema)


