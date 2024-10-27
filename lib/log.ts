import { isDefined, isDefinedObject } from '@efflore/flow-sure'

/* === Types === */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/* === Constants === */

const DEV_MODE = process.env.DEV_MODE === 'true'

const LOG_DEBUG: LogLevel = 'debug'
const LOG_INFO: LogLevel = 'info'
const LOG_WARN: LogLevel = 'warn'
const LOG_ERROR: LogLevel = 'error'

/* === Internal Functions === */

/**
 * Check if a value is a non-empty string
 * 
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if the value is a non-empty string
 */
const isString = (value: unknown): value is string =>
	typeof value ==='string' && value.trim() !== ''

/**
 * Return selector string for the id of the element
 * 
 * @since 0.7.0
 * @param {string} id - id of the element
 * @returns {string} - id string for the element with '#' prefix
 */
const idString = (id: string): string => id ? `#${id}` : '';

/**
 * Return a selector string for classes of the element
 * 
 * @since 0.7.0
 * @param {DOMTokenList} classList - DOMTokenList to convert to a string
 * @returns {string} - class string for the DOMTokenList with '.' prefix if any
 */
const classString = (classList: DOMTokenList): string =>
	classList.length ? `.${Array.from(classList).join('.')}` : ''

/* === Exported Functions === */

/**
 * Return a HyperScript string representation of the Element instance
 * 
 * @since 0.7.0
 * @param {Element} el 
 * @returns {string}
 */
const elementName = (el: Element): string =>
	`<${el.localName}${idString(el.id)}${classString(el.classList)}>`

/**
 * Return a string representation of a JavaScript variable
 * 
 * @since 0.7.0
 * @param {unknown} value 
 * @returns {string}
 */
const valueString = (value: unknown): string =>
	isString(value) ? `"${value}"`
		: isDefinedObject(value) ? JSON.stringify(value)
		: isDefined(value) ? String(value)
		: 'undefined'

/**
 * Log a message to the console with the specified level
 * 
 * @since 0.7.0
 * @param {T} value - value to inspect
 * @param {string} msg - message to log
 * @param {LogLevel} level - log level
 * @returns {T} - value passed through
 */
const log = <T>(value: T, msg: string, level: LogLevel = LOG_DEBUG): T => {
	if (DEV_MODE || ([LOG_ERROR, LOG_WARN] as LogLevel[]).includes(level)) console[level](msg, value)
	return value
}

export {
	DEV_MODE, LOG_DEBUG, LOG_INFO, LOG_WARN, LOG_ERROR,
	log, elementName, valueString,
}