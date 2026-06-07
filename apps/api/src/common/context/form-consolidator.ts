import { InteractionRegistry, AiReadyContext } from '@testlens/contracts';

type FormType = AiReadyContext['forms'][number];

export function consolidateForms(registry: InteractionRegistry): AiReadyContext['forms'] {
  const formsList: FormType[] = [];

  // Group elements by file path
  const fileGroups = new Map<string, typeof registry.ui_elements>();
  for (const element of registry.ui_elements) {
    const existing = fileGroups.get(element.path) || [];
    existing.push(element);
    fileGroups.set(element.path, existing);
  }

  for (const [filePath, elements] of fileGroups.entries()) {
    const explicitForms = elements.filter((el) => el.type === 'form');
    const inputElements = elements.filter(
      (el) => el.type === 'input' || el.type === 'select' || el.type === 'textarea'
    );
    const buttons = elements.filter((el) => el.type === 'button');

    // Map elements to output structures
    const mappedInputs = inputElements.map((el) => ({
      name: el.attributes.name,
      id: el.attributes.id,
      type: el.type === 'input' ? el.attributes.type || 'text' : el.type,
      test_id: el.attributes.dataTestId
    }));

    const mappedButtons = buttons.map((el) => ({
      id: el.attributes.id,
      test_id: el.attributes.dataTestId
    }));

    if (explicitForms.length > 0) {
      for (const form of explicitForms) {
        formsList.push({
          path: filePath,
          form_id: form.attributes.id,
          form_name: form.attributes.name,
          test_id: form.attributes.dataTestId,
          inputs: mappedInputs,
          submit_buttons: mappedButtons
        });
      }
    } else if (mappedInputs.length > 0 || mappedButtons.length > 0) {
      // Create implicit form container if there are fields but no explicit <form> tag
      formsList.push({
        path: filePath,
        form_name: 'implicit-form',
        inputs: mappedInputs,
        submit_buttons: mappedButtons
      });
    }
  }

  return formsList;
}
