export default {
    async fetch(request, env) {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  
      try {
        const update = await request.json();
        if (!update.message) return new Response("OK");
        
        const { chat, text, document } = update.message;
        const chatId = chat.id;
  
        // Log update for debugging
        console.log("Received update:", JSON.stringify(update));
  
        // Handle commands
        if (text?.startsWith("/")) {
          return handleCommand(text, chatId, env);
        }
        
        // Handle file upload
        if (document) {
          return handleFileUpload(document, chatId, env);
        }
  
        return sendMessage(chatId, "📁 Kirim file atau gunakan perintah /help", env);
        
      } catch (error) {
        console.error("Error:", error.stack || error.message || error);
        return new Response("Server Error", { status: 500 });
      }
    }
  };
  
  async function handleCommand(text, chatId, env) {
    const [command] = text.split(" ");
    switch(command.toLowerCase()) {
      case "/start":
        return sendMessage(chatId, 
          "🚀 *Gofile Upload Bot*\n\nKirim file untuk upload ke Gofile! Bot ini mendukung file hingga 25MB.\n\nKetik /help untuk bantuan.", 
          env
        );
      case "/help":
        return sendMessage(chatId,
          "🔧 *Perintah:*\n" +
          "/settoken [TOKEN] - Set token GoFile\n" +
          "/status - Cek akun\n\n" +
          "📤 Bot ini mendukung file hingga 25MB menggunakan direct URL upload.",
          env
        );
      case "/settoken":
        return setTokenCommand(text, chatId, env);
      case "/status":
        return getAccountStatus(chatId, env);
      default:
        return sendMessage(chatId, "❌ Perintah tidak dikenal", env);
    }
  }
  
  async function handleFileUpload(document, chatId, env) {
    try {
      // 1. Validasi ukuran file maksimal 25MB (25 * 1024 * 1024 bytes)
      const MAX_FILE_SIZE = 26214400; // 25MB in bytes
      if (document.file_size > MAX_FILE_SIZE) {
        return sendMessage(chatId, "❌ File melebihi batas 25MB", env);
      }
  
      await sendMessage(chatId, "⏳ Memproses file...", env);
      
      // 2. Dapatkan token GoFile dari KV
      const gofileToken = await env.KV.get(`token:${chatId}`);
      if (!gofileToken) {
        return sendMessage(chatId, "❌ Token belum di-set! Gunakan /settoken [TOKEN_ANDA]", env);
      }
  
      // 3. Dapatkan URL file dari Telegram
      const getFileResponse = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/getFile?file_id=${document.file_id}`
      );
      
      if (!getFileResponse.ok) {
        console.error("Failed to get file info:", await getFileResponse.text());
        return sendMessage(chatId, "❌ Gagal mendapatkan informasi file dari Telegram", env);
      }
      
      const fileInfo = await getFileResponse.json();
      console.log("File info:", JSON.stringify(fileInfo));
      
      if (!fileInfo.ok || !fileInfo.result || !fileInfo.result.file_path) {
        return sendMessage(chatId, "❌ File tidak tersedia di server Telegram", env);
      }
      
      const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_TOKEN}/${fileInfo.result.file_path}`;
  
      // 4. Dapatkan server terbaik GoFile
      await sendMessage(chatId, "🔍 Mendapatkan server GoFile terbaik...", env);
      
      // Using updated endpoint from documentation
      const serverResponse = await fetch("https://api.gofile.io/servers", {
        headers: { 
          "Authorization": `Bearer ${gofileToken}`
        }
      });
      
      if (!serverResponse.ok) {
        console.error("Failed to get server:", await serverResponse.text());
        return sendMessage(chatId, "❌ Gagal mendapatkan server GoFile", env);
      }
      
      const serverData = await serverResponse.json();
      console.log("Server data:", JSON.stringify(serverData));
      
      // Handle API changes based on new documentation
      if (!serverData.data || !serverData.data.servers || serverData.data.servers.length === 0) {
        return sendMessage(chatId, "❌ Server GoFile tidak tersedia saat ini", env);
      }
      
      // Use the first server from the list
      const server = serverData.data.servers[0];
      await sendMessage(chatId, `🔄 Mengupload ke server ${server}...`, env);
      
      // 5. Prepare form data for upload
      // Use FormData for multipart/form-data as required by the updated API
      const formData = new FormData();
      
      // Create a fetch request to get the file from Telegram
      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) {
        return sendMessage(chatId, "❌ Gagal mengambil file dari Telegram", env);
      }
      
      // Get the file blob
      const fileBlob = await fileResponse.blob();
      
      // Append the file to the form data with the file name
      formData.append("file", fileBlob, document.file_name || "file");
      
      // 6. Upload file to GoFile using global endpoint (recommended in docs)
      const uploadResponse = await fetch("https://upload.gofile.io/uploadfile", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${gofileToken}`
        },
        body: formData
      });
      
      const uploadResponseText = await uploadResponse.text();
      console.log("Upload response text:", uploadResponseText);
      
      if (!uploadResponse.ok) {
        console.error("Upload failed with status:", uploadResponse.status);
        return sendMessage(chatId, `❌ Gagal upload file. Status: ${uploadResponse.status}`, env);
      }
      
      // 7. Parse the response
      let uploadResult;
      try {
        uploadResult = JSON.parse(uploadResponseText);
      } catch (e) {
        console.error("Failed to parse upload response:", e);
        return sendMessage(chatId, "❌ Respon dari GoFile tidak valid", env);
      }
      
      console.log("Upload result:", JSON.stringify(uploadResult));
      
      // 8. Handle specific error codes from GoFile API
      if (uploadResult.status === "error-notFound") {
        return sendMessage(chatId, 
          "❌ Error: Folder tidak ditemukan. Token mungkin tidak valid atau folder sudah dihapus.", 
          env
        );
      }
      
      if (uploadResult.status && uploadResult.status.startsWith("error-")) {
        return sendMessage(chatId, `❌ GoFile API Error: ${uploadResult.status}`, env);
      }
      
      // 9. Process successful upload
      if (uploadResult.data) {
        const fileName = document.file_name || "File";
        const fileSize = formatBytes(document.file_size);
        
        // Handle different response format based on updated API
        const downloadLink = uploadResult.data.downloadPage || 
                            (uploadResult.data.fileId ? `https://gofile.io/d/${uploadResult.data.fileId}` : null);
        
        if (!downloadLink) {
          return sendMessage(chatId, "✅ File terupload, tetapi link download tidak tersedia", env);
        }
        
        return sendMessage(chatId,
          `✅ *Upload Berhasil!*\n\n` +
          `📄 File: ${fileName}\n` +
          `📊 Ukuran: ${fileSize}\n` +
          `🔗 Link: ${downloadLink}`,
          env
        );
      } else {
        return sendMessage(chatId, `❌ Upload gagal: ${uploadResult.status || "unknown error"}`, env);
      }
    } catch (error) {
      console.error("Upload Error:", error.stack || error.message || error);
      return sendMessage(chatId, "❌ Terjadi kesalahan saat upload. Detail error telah dicatat.", env);
    }
  }
  
  async function setTokenCommand(text, chatId, env) {
    const token = text.split(" ")[1]?.trim();
    if (!token) return sendMessage(chatId, "Format: /settoken [TOKEN_ANDA]", env);
    
    try {
      // Validate token with updated API endpoint
      const validateResponse = await fetch("https://api.gofile.io/accounts/getid", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (!validateResponse.ok) {
        const errorText = await validateResponse.text();
        console.error("Token validation error response:", errorText);
        return sendMessage(chatId, "❌ Token tidak valid atau server GoFile sedang tidak tersedia", env);
      }
      
      const validateData = await validateResponse.json();
      if (validateData.status && validateData.status.startsWith("error-")) {
        return sendMessage(chatId, `❌ Token tidak valid: ${validateData.status}`, env);
      }
      
      // Simpan token
      await env.KV.put(`token:${chatId}`, token);
      return sendMessage(chatId, "🔑 Token berhasil disimpan! Sekarang Anda bisa upload file hingga 25MB.", env);
    } catch (error) {
      console.error("Token validation error:", error);
      return sendMessage(chatId, "❌ Gagal memvalidasi token", env);
    }
  }
  
  async function getAccountStatus(chatId, env) {
    try {
      const token = await env.KV.get(`token:${chatId}`);
      if (!token) return sendMessage(chatId, "❌ Token belum di-set. Gunakan /settoken [TOKEN_ANDA]", env);
      
      // Cek ID akun with updated endpoint
      const accountResponse = await fetch("https://api.gofile.io/accounts/getid", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (!accountResponse.ok) {
        console.error("Account ID error status:", accountResponse.status);
        const errorText = await accountResponse.text();
        console.error("Account ID error response:", errorText);
        return sendMessage(chatId, "❌ Gagal mendapatkan ID akun. Token mungkin tidak valid.", env);
      }
      
      const accountData = await accountResponse.json();
      console.log("Account data:", JSON.stringify(accountData));
      
      if (accountData.status && accountData.status.startsWith("error-")) {
        return sendMessage(chatId, `❌ Error: ${accountData.status}`, env);
      }
      
      if (!accountData.data || !accountData.data.id) {
        return sendMessage(chatId, "❌ Data akun tidak tersedia dari GoFile", env);
      }
      
      // Get account details with updated endpoint
      const accountId = accountData.data.id;
      const detailsResponse = await fetch(`https://api.gofile.io/accounts/${accountId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (!detailsResponse.ok) {
        console.error("Account details error status:", detailsResponse.status);
        const errorText = await detailsResponse.text();
        console.error("Account details error response:", errorText);
        return sendMessage(chatId, "❌ Gagal mendapatkan detail akun", env);
      }
      
      const details = await detailsResponse.json();
      console.log("Account details:", JSON.stringify(details));
      
      if (details.status && details.status.startsWith("error-")) {
        return sendMessage(chatId, `❌ Error detail akun: ${details.status}`, env);
      }
      
      if (!details.data) {
        return sendMessage(chatId, "❌ Detail akun tidak tersedia dari GoFile", env);
      }
      
      // Format informasi akun
      return sendMessage(chatId,
        `👤 *Info Akun GoFile*\n\n` +
        `ID: \`${accountId}\`\n` +
        `Premium: ${details.data.premium ? "✅" : "❌"}\n` +
        `Tier: ${details.data.tier || "Standard"}\n` +
        `File Count: ${details.data.filesCount || 0}\n` +
        `Root Folder: \`${details.data.rootFolder || "N/A"}\``,
        env
      );
      
    } catch (error) {
      console.error("Account status error:", error);
      return sendMessage(chatId, "❌ Terjadi kesalahan saat mengecek status akun", env);
    }
  }
  
  async function sendMessage(chatId, text, env) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: "Markdown",
          disable_web_page_preview: true
        })
      });
      
      if (!response.ok) {
        console.error("Failed to send message:", await response.text());
      }
      
      return new Response("OK");
    } catch (error) {
      console.error("Send message error:", error);
      return new Response("Failed to send message", { status: 500 });
    }
  }
  
  // Format bytes to readable size
  function formatBytes(bytes, decimals = 2) {
    if (!bytes) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }