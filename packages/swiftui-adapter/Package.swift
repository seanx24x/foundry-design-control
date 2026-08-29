// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "FoundryDesignControl",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "FoundryDesignControl", targets: ["FoundryDesignControl"])],
    targets: [
        .target(name: "FoundryDesignControl"),
        .testTarget(name: "FoundryDesignControlTests", dependencies: ["FoundryDesignControl"]),
    ]
)
