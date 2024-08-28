// This shows the HTML page in "ui.html".
figma.showUI(__html__);

// This is the function that runs when the plugin is launched
function generatePrismaSchemaFromNestedObjectDirectly(nestedObject: Record<string, any>): string {
  // To store the schema string
  let schema = `// Generated Prisma Schema\n\n`;

  // Helper function to convert types to Prisma types
  const convertTypeToPrisma = (type: string): string => {
    switch (type) {
      case "string":
        return "String";
      case "number":
        return "Float"; // Use 'Int' if you specifically need integer values
      default:
        return "String"; // Default type for unknown types
    }
  };

  // Recursive function to traverse the nested object and build schema
  function traverseObject(obj: Record<string, any>, modelName: string, parentName: string | null = null): void {
    const currentModelName = modelName.charAt(0).toUpperCase() + modelName.slice(1);

    let modelSchema = `model ${currentModelName} {\n`;
    const fields: string[] = [];

    for (const key in obj) {
      if (typeof obj[key] === "object") {
        // If it's a nested object, create a new model for it
        const nestedModelName = `${modelName}_${key}`;
        fields.push(`${key} ${nestedModelName.charAt(0).toUpperCase() + nestedModelName.slice(1)}`);
        traverseObject(obj[key], nestedModelName, currentModelName);
      } else {
        // Otherwise, add it as a field with the appropriate type
        fields.push(`${key} ${convertTypeToPrisma(obj[key])}`);
      }
    }

    if (parentName) {
      // Add a relation field to the parent model
      const parentField = parentName.charAt(0).toLowerCase() + parentName.slice(1);
      fields.push(`${parentField} ${parentName.charAt(0).toUpperCase() + parentName.slice(1)}? @relation(fields: [${parentField}Id], references: [id])`);
      fields.push(`${parentField}Id Int?`);
    }

    // Add all fields to the model schema
    modelSchema += fields.map((field) => `  ${field}`).join("\n");
    modelSchema += `\n}\n\n`;

    // Append the model schema to the overall schema string
    schema += modelSchema;
  }

  // Start generating schema from the root object
  for (const modelName in nestedObject) {
    traverseObject(nestedObject[modelName], modelName);
  }

  return schema;
}

function generateNestedObject(fields: string[]): Record<string, unknown> {
  // Initialize an empty object to store the nested structure
  const nestedObject: Record<string, unknown> = {};

  // Function to convert type strings
  const convertType = (type: string): string => {
    switch (type) {
      case "string":
        return "string";
      case "number":
        return "number";
      default:
        return "unknown";
    }
  };

  // Parse each field and build the nested object
  for (const field of fields) {
    const [path, type] = field.split(":");
    const pathParts = path.split(".");

    // Initialize a reference to the current level of the nested object
    let currentLevel = nestedObject;

    // Traverse the path parts and build the nested structure
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];

      // If it's the last part, assign the type
      if (i === pathParts.length - 1) {
        currentLevel[part] = convertType(type);
      } else {
        // If the part doesn't exist, create an empty object
        if (!currentLevel[part]) {
          currentLevel[part] = {};
        }
        // Move to the next level in the object
        currentLevel = currentLevel[part] as Record<string, unknown>;
      }
    }
  }

  return nestedObject;
}

figma.on("run", () => {
  console.log("Generating field object...");

  // This array will hold all the matching text inputs
  const matchingFields: string[] = [];

  // Function to recursively search for text nodes
  function searchNodes(node: SceneNode) {
    if (node.type === "TEXT") {
      const textNode = node as TextNode;
      // Check if the text node's name matches the pattern
      if (/^[a-z]+(\.[a-z]+)+:[a-z]+$/i.test(textNode.name)) {
        matchingFields.push(textNode.name);
        console.log(textNode.name);
      }
    } else if ("children" in node) {
      // If the node has children, recursively search them
      for (const child of node.children) {
        searchNodes(child);
      }
    }
  }

  // Start searching from the current page
  figma.currentPage.children.forEach(searchNodes);

  // Generate the JSON object and Prisma schema
  const nestedObject = generateNestedObject(matchingFields);
  const prismaSchema = generatePrismaSchemaFromNestedObjectDirectly(nestedObject);

  // Convert JSON object to string format
  const jsonObjectString = JSON.stringify(nestedObject, null, 2);

  // Show the UI to handle file export
  figma.showUI(__html__);
  figma.ui.postMessage({ jsonObjectString, prismaSchema });

  // Close the plugin
  // figma.closePlugin();
});
