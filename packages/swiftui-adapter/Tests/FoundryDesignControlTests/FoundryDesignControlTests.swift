import XCTest
@testable import FoundryDesignControl

final class FoundryDesignControlTests: XCTestCase {
    func testFoundryValueRoundTrip() throws {
        let values: [FoundryValue] = [.number(320), .string("spring"), .boolean(true), .null]
        let data = try JSONEncoder().encode(values)
        XCTAssertEqual(try JSONDecoder().decode([FoundryValue].self, from: data), values)
    }
}
