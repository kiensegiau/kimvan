import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Vui lòng thêm URI MongoDB vào biến môi trường.');
}

const uri = process.env.MONGODB_URI;
const options = {};

let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  // Trong môi trường phát triển, sử dụng biến global để lưu lại kết nối
  let globalWithMongo = global;

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // Trong môi trường sản xuất, tạo kết nối mới
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise; 