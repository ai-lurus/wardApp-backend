// Import each tool file to trigger its top-level register() calls.
// Must be imported before any route handler accesses the tool registry.
import "./fleets.tool";
import "./finance.tool";
import "./operators.tool";
import "./inventory.tool";
import "./compliance.tool";
