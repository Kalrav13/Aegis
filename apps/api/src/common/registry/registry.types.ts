export interface UIElement {
  path: string;
  type: "button" | "input" | "form" | "select" | "textarea";
  attributes: {
    dataTestId?: string;
    id?: string;
    name?: string;
    type?: string;
  };
}

export interface APIEndpoint {
  path: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  route: string;
  parameters: string[];
}

export interface InteractionRegistry {
  ui_elements: UIElement[];
  api_endpoints: APIEndpoint[];
}
