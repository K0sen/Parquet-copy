const pipe = require('../../helpers/pipe');
const wrapFieldWithParent = require('../helpers/wrapFieldWithParent');
const prependFieldWithSpaces = require('../helpers/prependFieldWithSpaces');
const transformFieldToDremelString = require('../helpers/transformFieldToDremelString');
const hasFieldChild = require('../helpers/hasFieldChild');
const getFieldChildren = require('../helpers/getFieldChildren');
const getFieldDefinitionWrapper = require('../helpers/getFieldDefinition');

const SPACE_INDENT_AMOUNT = 2;
const HEADER = 'header';
const NESTED_FIELD = 'nested field';
const SINGLE_FIELD = 'single field';

const defineFieldType = jsonSchema => {
	if (jsonSchema.title) {
		return HEADER;
	}

	if (hasFieldChild(jsonSchema)) {
		return NESTED_FIELD;
	}

	return SINGLE_FIELD;
};

const transformHeader = field => `message ${field.title} {\n}`;
const transformNestedField = field => `${transformFieldToDremelString(field)} {\n}`;
const transformSingleField = field => `${transformFieldToDremelString(field)};`;

const transformFieldByType = type => field => {
	switch(type) {
		case HEADER: return transformHeader(field);
		case NESTED_FIELD: return transformNestedField(field);
		case SINGLE_FIELD: return transformSingleField(field);
		default: return '';
	}
};

const setName = name => field => Object.assign({}, field, { name });
const isDefinition = field => Boolean(field.$ref);

const removeChildFromField = field => {
	const newField = Object.assign({}, field);
	delete newField.properties;
	delete newField.patternProperties;
	delete newField.items;
	return newField;
}

const reformatField = field => pipe([
	field => isDefinition(field) ? getFieldDefinition(field) : field,
	field => field.physicalType ? removeChildFromField(field) : field,
])(field);

const transformFields = getFieldDefinition => (fields, spaceAmount = 0, initialParent = null) =>
	Object.entries(fields).reduce((parent, [fieldName, fieldBody]) => {
		const field = reformatField(fieldBody);
		const fieldType = defineFieldType(field);
		const preparedField = pipe([
			setName(fieldName),
			transformFieldByType(fieldType),
			prependFieldWithSpaces(spaceAmount),
		])(field);

		if (fieldType === SINGLE_FIELD) {
			return wrapFieldWithParent(preparedField, parent);
		}

		const children = getFieldChildren(field);
		return wrapFieldWithParent(
			transformFields(getFieldDefinition)(children, spaceAmount + SPACE_INDENT_AMOUNT, preparedField),
			parent
		);
	}, initialParent);

const transformSchema = (jsonSchema, definitions) => {
	const header = transformFieldByType(HEADER)(jsonSchema);
	if (!hasFieldChild(jsonSchema)) {
		return header;
	}

	const getFieldDefinition = getFieldDefinitionWrapper(definitions);
	const children = getFieldChildren(jsonSchema);
	return transformFields(getFieldDefinition)(children, SPACE_INDENT_AMOUNT, header);
};

module.exports = {
	transformSchema,
};
