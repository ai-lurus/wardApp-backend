const API_URL = "http://localhost:3001/api/auth";
const EMAIL = "lcortes1355@gmail.com"; 
const PASSWORD = "password";

async function runTests() {
  console.log("=== INICIANDO PRUEBAS DE REFRESH TOKENS ===");
  
  let currentCookie = "";

  // 1. Login
  console.log("\n1. Intentando Login...");
  const loginRes = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });

  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    console.error("Login falló:", loginData);
    return;
  }
  
  console.log("✅ Login exitoso. AccessToken:", loginData.token.substring(0, 20) + "...");
  const setCookieStr = loginRes.headers.get('set-cookie');
  if (!setCookieStr || !setCookieStr.includes("refreshToken=")) {
    console.error("No se encontró la cookie refreshToken en la respuesta");
    return;
  }
  
  const cookiesList = setCookieStr.split(', ');
  for (const c of cookiesList) {
    if (c.includes("refreshToken=")) {
        currentCookie = c.split(';')[0];
    }
  }

  console.log("✅ Cookie obtenida:", currentCookie);

  // 2. Refresh Token Exitoso
  console.log("\n2. Intentando Refresh Token...");
  const refreshRes = await fetch(`${API_URL}/refresh`, {
    method: 'POST',
    headers: { 'Cookie': currentCookie }
  });
  
  const refreshData = await refreshRes.json();
  if (!refreshRes.ok) {
    console.error("Refresh falló:", refreshData);
    return;
  }

  console.log("✅ Refresh exitoso. Nuevo AccessToken:", refreshData.token.substring(0, 20) + "...");
  const newSetCookieStr = refreshRes.headers.get('set-cookie');
  let newCookie = "";
  if (newSetCookieStr) {
      const parts = newSetCookieStr.split(', ');
      for (const p of parts) {
          if (p.includes("refreshToken=")) {
              newCookie = p.split(';')[0];
          }
      }
  }
  console.log("✅ Nueva Cookie obtenida:", newCookie);

  // 3. Probar Kill Switch (Usar Token Antiguo)
  console.log("\n3. Probando Kill-Switch de Seguridad (reuso de token antiguo)...");
  const killSwitchRes = await fetch(`${API_URL}/refresh`, {
    method: 'POST',
    headers: { 'Cookie': currentCookie } // Usa el PRIMER token recuperado
  });
  
  const killSwitchData = await killSwitchRes.json();
  if (killSwitchRes.status === 401) {
    console.log("✅ Kill-Switch activado correctamente. Respuesta:", killSwitchData.error || killSwitchData.message);
  } else {
    console.error("❌ Falló la prueba Kill-Switch, status fue:", killSwitchRes.status);
  }

  // 4. Probar que la Sesión fue Cerrada Totalmente (usar el nuevo token después del kill-switch)
  console.log("\n4. Verificando que todas las sesiones se cerraron...");
  const verifyRes = await fetch(`${API_URL}/refresh`, {
    method: 'POST',
    headers: { 'Cookie': newCookie }
  });

  const verifyData = await verifyRes.json();
  if (verifyRes.status === 401) {
    console.log("✅ Sesión invalidada correctamente. Respuesta:", verifyData.error || verifyData.message);
  } else {
    console.error("❌ Las sesiones no fueron cerradas. Status:", verifyRes.status);
  }

  console.log("\n=== PRUEBAS FINALIZADAS CON ÉXITO ===");
}

runTests().catch(console.error);
