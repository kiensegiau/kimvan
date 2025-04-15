export async function GET(request) {
  // URL đích mặc định
  const targetUrl = "https://www.youtube.com";
  
  // Log để debug
  console.log("API redirect được gọi");
  
  // Tạo và trả về response chuyển hướng
  return new Response(null, {
    status: 302,
    headers: {
      'Location': targetUrl
    }
  });
} 