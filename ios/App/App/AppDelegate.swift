import UIKit
import Capacitor
import AVFoundation
import WebKit
// IBRATV — برمجة و تطوير ابراهيم الخزرجي

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // TV sound plays even with the silent switch on, and keeps playing in the background / PiP
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback, options: [])
        try? AVAudioSession.sharedInstance().setActive(true)
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

// MARK: - السينما (native WKWebView overlay with ad & popup blocking)

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(CinemaPlugin())
    }
}

@objc(CinemaPlugin)
public class CinemaPlugin: CAPPlugin, CAPBridgedPlugin, WKNavigationDelegate, WKUIDelegate {
    public let identifier = "CinemaPlugin"
    public let jsName = "Cinema"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBounds", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVisible", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "back", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "forward", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "close", returnType: CAPPluginReturnPromise)
    ]

    private var web: WKWebView?
    private var rules: WKContentRuleList?
    private var adHosts = Set<String>()
    private var blocked = 0
    private var observers: [NSKeyValueObservation] = []

    static let adSelectors = "ins.adsbygoogle, [id^='google_ads'], [id^='div-gpt-ad'], iframe[src*='doubleclick'], iframe[src*='googlesyndication'], [class*='popunder'], [id*='popunder'], [class*='ad-banner'], [id*='ad-banner'], [class*='advertis'], [id*='advertis'], div[data-ad-slot], amp-ad"
    static let shieldJS = "window.open = function(){ return null; };"

    override public func load() {
        if let path = Bundle.main.path(forResource: "adblock-hosts", ofType: "txt", inDirectory: "public"),
           let text = try? String(contentsOfFile: path, encoding: .utf8) {
            for raw in text.split(separator: "\n") {
                let h = raw.trimmingCharacters(in: .whitespaces).lowercased()
                if !h.isEmpty && !h.hasPrefix("#") { adHosts.insert(h) }
            }
        }
    }

    private func isAd(_ host: String?) -> Bool {
        guard var h = host?.lowercased() else { return false }
        while !h.isEmpty {
            if adHosts.contains(h) { return true }
            guard let dot = h.firstIndex(of: ".") else { break }
            h = String(h[h.index(after: dot)...])
        }
        return false
    }

    private func site(_ host: String?) -> String {
        let parts = (host ?? "").split(separator: ".")
        return parts.count < 2 ? (host ?? "") : parts.suffix(2).joined(separator: ".")
    }

    private func compileRules(_ done: @escaping () -> Void) {
        if rules != nil || adHosts.isEmpty { done(); return }
        var arr: [[String: Any]] = []
        for h in adHosts {
            let escaped = NSRegularExpression.escapedPattern(for: h)
            arr.append(["trigger": ["url-filter": "^[^:]+://+([^:/]+\\.)?" + escaped + "[:/]"], "action": ["type": "block"]])
        }
        arr.append(["trigger": ["url-filter": ".*"], "action": ["type": "css-display-none", "selector": CinemaPlugin.adSelectors]])
        guard let data = try? JSONSerialization.data(withJSONObject: arr), let json = String(data: data, encoding: .utf8) else { done(); return }
        WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "ibratv-adblock", encodedContentRuleList: json) { list, _ in
            self.rules = list
            done()
        }
    }

    private func frameFor(_ call: CAPPluginCall) -> CGRect {
        let x = call.getDouble("x") ?? 0, y = call.getDouble("y") ?? 0
        let w = call.getDouble("w") ?? 100, h = call.getDouble("h") ?? 100
        let o = bridge?.webView?.frame.origin ?? .zero
        return CGRect(x: o.x + CGFloat(x), y: o.y + CGFloat(y), width: CGFloat(w), height: CGFloat(h))
    }

    private func ensureView(_ done: @escaping (WKWebView) -> Void) {
        if let w = web { done(w); return }
        compileRules {
            let cfg = WKWebViewConfiguration()
            cfg.allowsInlineMediaPlayback = true
            cfg.mediaTypesRequiringUserActionForPlayback = []
            cfg.allowsPictureInPictureMediaPlayback = true
            if let r = self.rules { cfg.userContentController.add(r) }
            cfg.userContentController.addUserScript(WKUserScript(source: CinemaPlugin.shieldJS, injectionTime: .atDocumentStart, forMainFrameOnly: false))
            let w = WKWebView(frame: .zero, configuration: cfg)
            w.navigationDelegate = self
            w.uiDelegate = self
            w.allowsBackForwardNavigationGestures = true
            w.backgroundColor = .white
            w.customUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
            self.observers = [
                w.observe(\.isLoading, options: [.new]) { [weak self] _, _ in self?.emit() },
                w.observe(\.canGoBack, options: [.new]) { [weak self] _, _ in self?.emit() }
            ]
            if let host = self.bridge?.webView, let sup = host.superview { sup.addSubview(w) }
            self.web = w
            done(w)
        }
    }

    private func emit() {
        guard let w = web else { return }
        notifyListeners("state", data: ["loading": w.isLoading, "canBack": w.canGoBack, "blocked": blocked])
    }

    @objc func open(_ call: CAPPluginCall) {
        guard let s = call.getString("url"), let url = URL(string: s) else { call.reject("bad url"); return }
        DispatchQueue.main.async {
            let frame = self.frameFor(call)
            self.ensureView { w in
                w.frame = frame
                w.isHidden = false
                self.blocked = 0
                w.load(URLRequest(url: url))
                call.resolve()
            }
        }
    }

    @objc func setBounds(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.web?.frame = self.frameFor(call); call.resolve() }
    }

    @objc func setVisible(_ call: CAPPluginCall) {
        let v = call.getBool("visible") ?? true
        DispatchQueue.main.async { self.web?.isHidden = !v; call.resolve() }
    }

    @objc func back(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let can = self.web?.canGoBack ?? false
            if can { self.web?.goBack() }
            call.resolve(["handled": can])
        }
    }

    @objc func forward(_ call: CAPPluginCall) { DispatchQueue.main.async { self.web?.goForward(); call.resolve() } }
    @objc func reload(_ call: CAPPluginCall) { DispatchQueue.main.async { self.web?.reload(); call.resolve() } }

    @objc func close(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.observers = []
            self.web?.stopLoading()
            self.web?.removeFromSuperview()
            self.web = nil
            call.resolve()
        }
    }

    // pop-ups: a same-site link opens in place, anything else is blocked
    public func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        let dst = navigationAction.request.url?.host
        if navigationAction.navigationType == .linkActivated, site(dst) == site(webView.url?.host), !isAd(dst) {
            webView.load(navigationAction.request)
        } else {
            blocked += 1
            emit()
        }
        return nil
    }

    public func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let url = navigationAction.request.url
        let scheme = url?.scheme?.lowercased() ?? ""
        if isAd(url?.host) { blocked += 1; emit(); decisionHandler(.cancel); return }
        if scheme != "http" && scheme != "https" && scheme != "about" && scheme != "blob" && scheme != "data" { decisionHandler(.cancel); return }
        decisionHandler(.allow)
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { emit() }
    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { emit() }
}
