// // services/comment.service.ts

// import Comment from '@/models/Comment';
// import { getIO } from '@/server/socket';

// const comment=

// await Comment.create(data);



// getIO()?.emit(

// "new-comment",

// comment

// );



// // return comment;

// export async function createComment(data: {
//   task: string;
//   user: string;
//   text: string;
// }) {
//   return Comment.create({
//     task: data.task,
//     user: data.user,
//     text: data.text,
//   });
// }

// export async function getComments(task: string) {
//   return Comment.find({ task }).populate({ path: 'user', select: '-password' }).sort({ createdAt: -1 });
// }

// export async function deleteComments(id: string) {
//   return Comment.findByIdAndDelete(id);
// }


import Comment, { IComment } from '@/models/Comment'; // Assuming IComment interface exists
import { getIO } from "@/server/socket";

// Strict Types for Input Data
export type CreateCommentDTO = {
  task: string;
  user: string;
  text: string;
};

export async function createComment(data: CreateCommentDTO) {
  // 1. Database mein comment create karo
  const savedComment = await Comment.create(data);

  // 2. CRITICAL: Comment ko populate karo taake frontend ko pata chale KISNE comment kiya
  // Aur .lean() lagao taake Socket.io crash na kare (Mongoose serialization issue)
  const populatedComment = await Comment.findById(savedComment._id)
    .populate({ path: 'user', select: '-password' })
    .lean();

  // 3. Socket Event Emit karo
  const io = getIO();
  if (io && populatedComment) {
    // SENIOR TIP: Sirf us specific TASK ke room mein event bhejo
    // Global broadcast nahi karna! Sirf wahi log dekhenge jo wo task khole hain.
    const roomId = `task:${data.task}`;
    
    io.to(roomId).emit("comment:created", {
      event: "COMMENT_CREATED",
      data: populatedComment 
    });
  }

  return populatedComment;
}

export async function getComments(task: string) {
  // .lean() add kiya API response fast aur safe banane ke liye
  return Comment.find({ task })
    .populate({ path: 'user', select: '-password' })
    .sort({ createdAt: -1 }) // Naye comments sabse upar
    .lean();
}

// Note: Function name singular kar diya (deleteComments -> deleteComment) 
// kyunki aap sirf EK id pass kar rahe hain.
export async function deleteComment(id: string) {
  // 1. Delete karne se pehle comment dhundo, taake pata chale ye kis TASK se belong karta hai
  const comment = await Comment.findById(id).lean();

  if (!comment) {
    throw new Error('Comment not found');
  }

  // 2. Database se delete karo
  await Comment.findByIdAndDelete(id);

  // 3. Socket event bhejo taake frontend se wo comment gayab ho jaye
  const io = getIO();
  if (io) {
    io.to(`task:${comment.task}`).emit("comment:deleted", {
      event: "COMMENT_DELETED",
      data: { _id: id } // Sirf ID bhejni hai frontend ko delete karne ke liye
    });
  }

  return { _id: id, deleted: true };
}