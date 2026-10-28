package com.ibrata2.ibratv;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Streams and playlists rarely send CORS headers, and many are plain http.
 * Requests from the player are fetched natively here, given the channel's
 * User-Agent / Referer, and handed back to the WebView with CORS allowed.
 * YouTube / Google traffic and images pass through untouched.
 */
public class IbraWebViewClient extends BridgeWebViewClient {
    static final String DEFAULT_UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36";
    private static final Pattern GOOGLE = Pattern.compile("(^|\\.)(youtube\\.com|youtube-nocookie\\.com|googlevideo\\.com|ytimg\\.com|google\\.com|gstatic\\.com|googleapis\\.com|doubleclick\\.net|ggpht\\.com)$");
    private final IbraNative nat;

    public IbraWebViewClient(Bridge bridge, IbraNative nat) {
        super(bridge);
        this.nat = nat;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        String host = uri.getHost() == null ? "" : uri.getHost();
        if (!(scheme.equals("http") || scheme.equals("https")) || host.equals("localhost")) {
            return super.shouldInterceptRequest(view, request);
        }
        Map<String, String> h = request.getRequestHeaders();
        boolean forced = h != null && (h.containsKey("X-Ibra-Proxy") || h.containsKey("x-ibra-proxy"));
        String method = request.getMethod();

        if ("OPTIONS".equalsIgnoreCase(method)) return preflight();
        if (GOOGLE.matcher(host).find() && !forced) return null;
        if (!request.isForMainFrame() && h != null) {
            String accept = h.containsKey("Accept") ? h.get("Accept") : "";
            if (accept != null && accept.startsWith("image/") && !forced) return null;   // logos, flags
        }
        if (!"GET".equalsIgnoreCase(method) && !"HEAD".equalsIgnoreCase(method)) return null;

        try {
            Map<String, String> send = new HashMap<>();
            if (h != null) for (Map.Entry<String, String> e : h.entrySet()) {
                String k = e.getKey();
                if (k.equalsIgnoreCase("Origin") || k.equalsIgnoreCase("X-Ibra-Proxy") || k.equalsIgnoreCase("Referer")) continue;
                send.put(k, e.getValue());
            }
            if (!GOOGLE.matcher(host).find()) {
                if (!nat.userAgent.isEmpty()) send.put("User-Agent", nat.userAgent);
                if (!nat.referrer.isEmpty()) {
                    send.put("Referer", nat.referrer);
                    try { Uri r = Uri.parse(nat.referrer); send.put("Origin", r.getScheme() + "://" + r.getHost()); } catch (Exception ignored) {}
                }
            } else {
                send.put("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36");
                send.put("Cookie", "SOCS=CAI; CONSENT=YES+1");
                send.put("Accept-Language", "ar,en;q=0.8");
            }
            HttpURLConnection c = open(uri.toString(), method.toUpperCase(Locale.ROOT), send);
            int code = c.getResponseCode();
            String finalUrl = c.getURL().toString();
            String type = c.getContentType();
            String mime = "application/octet-stream", charset = null;
            if (type != null) {
                String[] parts = type.split(";");
                mime = parts[0].trim();
                for (String p : parts) if (p.trim().toLowerCase(Locale.ROOT).startsWith("charset=")) charset = p.trim().substring(8);
            }
            InputStream body = code >= 400 ? c.getErrorStream() : c.getInputStream();
            if (body == null) body = new ByteArrayInputStream(new byte[0]);

            // a redirected HLS playlist: make its relative links absolute to the real location
            boolean isPlaylist = mime.contains("mpegurl") || finalUrl.toLowerCase(Locale.ROOT).contains(".m3u8");
            if (isPlaylist && !finalUrl.equals(uri.toString()) && code < 400) {
                String text = readAll(body);
                body = new ByteArrayInputStream(absolutize(text, finalUrl).getBytes(StandardCharsets.UTF_8));
            }

            Map<String, String> out = new HashMap<>();
            for (Map.Entry<String, List<String>> e : c.getHeaderFields().entrySet()) {
                if (e.getKey() == null || e.getValue() == null || e.getValue().isEmpty()) continue;
                String k = e.getKey().toLowerCase(Locale.ROOT);
                if (k.startsWith("access-control-") || k.equals("content-length") || k.equals("content-encoding") || k.equals("transfer-encoding") || k.equals("set-cookie")) continue;
                out.put(e.getKey(), e.getValue().get(0));
            }
            cors(out);
            String reason = c.getResponseMessage();
            if (reason == null || reason.trim().isEmpty()) reason = code < 400 ? "OK" : "Error";
            if (code >= 300 && code < 400) code = 502;   // unresolved redirect (WebResourceResponse can't carry 3xx)
            return new WebResourceResponse(mime, charset, code, reason, out, body);
        } catch (Exception e) {
            Map<String, String> out = new HashMap<>();
            cors(out);
            return new WebResourceResponse("text/plain", "utf-8", 502, "Bad Gateway", out, new ByteArrayInputStream(String.valueOf(e.getMessage()).getBytes(StandardCharsets.UTF_8)));
        }
    }

    /** Opens a connection, following redirects across http/https (HttpURLConnection won't). */
    static HttpURLConnection open(String url, String method, Map<String, String> headers) throws Exception {
        String cur = url;
        for (int i = 0; i < 6; i++) {
            HttpURLConnection c = (HttpURLConnection) new URL(cur).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            c.setRequestMethod(method);
            c.setRequestProperty("User-Agent", DEFAULT_UA);
            c.setRequestProperty("Accept-Encoding", "identity");
            if (headers != null) for (Map.Entry<String, String> e : headers.entrySet()) {
                if (e.getKey().equalsIgnoreCase("Accept-Encoding")) continue;
                c.setRequestProperty(e.getKey(), e.getValue());
            }
            int code = c.getResponseCode();
            if (code >= 300 && code < 400 && c.getHeaderField("Location") != null) {
                cur = new URL(new URL(cur), c.getHeaderField("Location")).toString();
                c.disconnect();
                continue;
            }
            return c;
        }
        throw new Exception("Too many redirects");
    }

    private static WebResourceResponse preflight() {
        Map<String, String> out = new HashMap<>();
        cors(out);
        out.put("Access-Control-Max-Age", "86400");
        return new WebResourceResponse("text/plain", "utf-8", 204, "No Content", out, new ByteArrayInputStream(new byte[0]));
    }

    private static void cors(Map<String, String> out) {
        out.put("Access-Control-Allow-Origin", "*");
        out.put("Access-Control-Allow-Headers", "*");
        out.put("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        out.put("Access-Control-Expose-Headers", "*");
    }

    private static String readAll(InputStream in) throws Exception {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
        return b.toString("UTF-8");
    }

    private static final Pattern URI_ATTR = Pattern.compile("URI=\"([^\"]+)\"");

    static String absolutize(String text, String base) {
        StringBuilder sb = new StringBuilder();
        for (String line : text.split("\r?\n")) {
            String t = line.trim();
            try {
                if (!t.isEmpty() && !t.startsWith("#")) {
                    line = new URL(new URL(base), t).toString();
                } else if (t.startsWith("#") && t.contains("URI=\"")) {
                    Matcher m = URI_ATTR.matcher(line);
                    StringBuffer out = new StringBuffer();
                    while (m.find()) m.appendReplacement(out, Matcher.quoteReplacement("URI=\"" + new URL(new URL(base), m.group(1)) + "\""));
                    m.appendTail(out);
                    line = out.toString();
                }
            } catch (Exception ignored) {}
            sb.append(line).append('\n');
        }
        return sb.toString();
    }
}
