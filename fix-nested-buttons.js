export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  root.find(j.JSXElement, {
    openingElement: { name: { name: "button" } }
  }).forEach(path => {
    j(path)
      .find(j.JSXElement, {
        openingElement: { name: { name: "button" } }
      })
      .forEach(innerPath => {
        innerPath.node.openingElement.name.name = "div";
        innerPath.node.closingElement.name.name = "div";

        innerPath.node.openingElement.attributes.push(
          j.jsxAttribute(j.jsxIdentifier("role"), j.literal("button"))
        );

        innerPath.node.openingElement.attributes.push(
          j.jsxAttribute(j.jsxIdentifier("tabIndex"), j.literal(0))
        );
      });
  });

  return root.toSource();
}
