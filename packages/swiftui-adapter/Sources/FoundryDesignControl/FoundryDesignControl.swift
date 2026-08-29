import Foundation
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

public enum FoundryValue: Codable, Sendable, Equatable {
    case string(String)
    case number(Double)
    case boolean(Bool)
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null }
        else if let value = try? container.decode(Bool.self) { self = .boolean(value) }
        else if let value = try? container.decode(Double.self) { self = .number(value) }
        else { self = .string(try container.decode(String.self)) }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .boolean(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }
}

public struct FoundryControl: Codable, Sendable, Equatable, Identifiable {
    public let id: String
    public let category: String
    public let property: String
    public let label: String
    public let valueType: String
    public var value: FoundryValue
    public let min: Double?
    public let max: Double?
    public let step: Double?
    public let unit: String?
    public let previewable: Bool
    public let supported: Bool

    public init(id: String, category: String, property: String, label: String, valueType: String, value: FoundryValue, min: Double? = nil, max: Double? = nil, step: Double? = nil, unit: String? = nil) {
        self.id = id; self.category = category; self.property = property; self.label = label
        self.valueType = valueType; self.value = value; self.min = min; self.max = max
        self.step = step; self.unit = unit; self.previewable = true; self.supported = true
    }
}

public struct FoundrySource: Codable, Sendable, Equatable {
    public let file: String
    public let line: Int?
    public let column: Int?
    public let symbol: String?
}

private struct FoundryGeometry: Encodable {
    let x: Double; let y: Double; let width: Double; let height: Double; let scale: Double
}

private struct FoundryTarget: Encodable {
    let id: String; let platform = "swiftui"; let semanticRole: String; let label: String
    let componentPath: [String]; let source: FoundrySource; let geometry: FoundryGeometry
    let locator: [String: String]; let confidence = "instrumented"; let evidence: [String]
}

private struct FoundrySurface: Encodable {
    let platform = "swiftui"; let width: Double; let height: Double; let frameDataUrl: String?
    let targets: [FoundryTarget]; let controlsByTarget: [String: [FoundryControl]]; let updatedAt: String
}

private struct CommandEnvelope: Decodable { let commands: [PreviewCommand] }
private struct PreviewCommand: Decodable { let targetId: String; let property: String; let value: FoundryValue; let createdAt: String }

private struct Registration {
    let label: String; let role: String; let componentPath: [String]; let source: FoundrySource
    var frame: CGRect; var controls: [FoundryControl]
}

@MainActor
public final class FoundrySession: ObservableObject {
    public let sessionID: String
    private let token: String
    private let runtimeURL: URL
    private var registrations: [String: Registration] = [:]
    private var tunables: [String: [String: (FoundryValue) -> Void]] = [:]
    private var timer: Timer?
    private var lastCommand = ""

    public init(sessionID: String, token: String, runtimeURL: URL = URL(string: "http://127.0.0.1:4387")!) {
        self.sessionID = sessionID; self.token = token; self.runtimeURL = runtimeURL
    }

    public func start(interval: TimeInterval = 1.0) {
        guard timer == nil else { return }
        timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.publish(); await self?.pollCommands() }
        }
        Task { await publish(); await pollCommands() }
    }

    public func stop() { timer?.invalidate(); timer = nil }

    public func registerTunable(targetID: String, property: String, apply: @escaping (FoundryValue) -> Void) {
        tunables[targetID, default: [:]][property] = apply
    }

    fileprivate func register(id: String, label: String, role: String, componentPath: [String], source: FoundrySource, controls: [FoundryControl]) {
        let existing = registrations[id]
        registrations[id] = Registration(label: label, role: role, componentPath: componentPath, source: source, frame: existing?.frame ?? .zero, controls: controls)
    }

    fileprivate func update(frames: [String: CGRect]) {
        for (id, frame) in frames where registrations[id] != nil { registrations[id]?.frame = frame }
    }

    private func publish() async {
        let bounds = screenBounds()
        let targets = registrations.compactMap { id, item -> FoundryTarget? in
            guard item.frame.width > 0, item.frame.height > 0 else { return nil }
            return FoundryTarget(id: id, semanticRole: item.role, label: item.label, componentPath: item.componentPath, source: item.source, geometry: FoundryGeometry(x: item.frame.minX, y: item.frame.minY, width: item.frame.width, height: item.frame.height, scale: displayScale()), locator: ["nativeId": id], evidence: ["SwiftUI GeometryReader", "Foundry debug modifier"])
        }
        let surface = FoundrySurface(width: bounds.width, height: bounds.height, frameDataUrl: captureFrame(), targets: targets, controlsByTarget: registrations.mapValues(\.controls), updatedAt: ISO8601DateFormatter().string(from: Date()))
        guard let data = try? JSONEncoder().encode(surface) else { return }
        _ = try? await request(path: "surface", method: "POST", body: data)
    }

    private func pollCommands() async {
        guard let data = try? await request(path: "commands?after=\(lastCommand.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")", method: "GET"), let envelope = try? JSONDecoder().decode(CommandEnvelope.self, from: data) else { return }
        for command in envelope.commands {
            tunables[command.targetId]?[command.property]?(command.value)
            lastCommand = command.createdAt
        }
    }

    private func request(path: String, method: String, body: Data? = nil) async throws -> Data {
        let parts = path.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false)
        var url = runtimeURL
            .appending(path: "v1")
            .appending(path: "sessions")
            .appending(path: sessionID)
            .appending(path: String(parts[0]))
        if parts.count == 2, var components = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            components.percentEncodedQuery = String(parts[1])
            if let composedURL = components.url { url = composedURL }
        }
        var request = URLRequest(url: url)
        request.httpMethod = method; request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(token, forHTTPHeaderField: "x-foundry-token")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode ?? 500 < 300 else { throw URLError(.badServerResponse) }
        return data
    }

    private func screenBounds() -> CGRect {
        #if canImport(UIKit)
        return UIScreen.main.bounds
        #else
        return registrations.values.reduce(.zero) { $0.union($1.frame) }
        #endif
    }

    private func displayScale() -> Double {
        #if canImport(UIKit)
        return UIScreen.main.scale
        #else
        return 1
        #endif
    }

    private func captureFrame() -> String? {
        #if canImport(UIKit)
        guard let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first,
              let window = scene.windows.first(where: \.isKeyWindow) ?? scene.windows.first else { return nil }
        let renderer = UIGraphicsImageRenderer(bounds: window.bounds)
        let image = renderer.image { _ in window.drawHierarchy(in: window.bounds, afterScreenUpdates: false) }
        guard let data = image.pngData() else { return nil }
        return "data:image/png;base64,\(data.base64EncodedString())"
        #else
        return nil
        #endif
    }
}

private struct FoundryFramePreference: PreferenceKey {
    static let defaultValue: [String: CGRect] = [:]
    static func reduce(value: inout [String: CGRect], nextValue: () -> [String: CGRect]) { value.merge(nextValue(), uniquingKeysWith: { _, next in next }) }
}

private struct FoundryInspectableModifier: ViewModifier {
    @ObservedObject var session: FoundrySession
    let id: String; let label: String; let role: String; let componentPath: [String]
    let source: FoundrySource; let controls: [FoundryControl]

    func body(content: Content) -> some View {
        content
            .overlay(GeometryReader { proxy in Color.clear.preference(key: FoundryFramePreference.self, value: [id: proxy.frame(in: .global)]) })
            .onPreferenceChange(FoundryFramePreference.self) { session.update(frames: $0) }
            .onAppear { session.register(id: id, label: label, role: role, componentPath: componentPath, source: source, controls: controls) }
    }
}

public extension View {
    func foundryInspectable(_ session: FoundrySession, id: String, label: String, role: String = "view", componentPath: [String] = [], controls: [FoundryControl] = [], file: String = #fileID, line: Int = #line, column: Int = #column, function: String = #function) -> some View {
        #if DEBUG
        modifier(FoundryInspectableModifier(session: session, id: id, label: label, role: role, componentPath: componentPath, source: FoundrySource(file: file, line: line, column: column, symbol: function), controls: controls))
        #else
        self
        #endif
    }
}
