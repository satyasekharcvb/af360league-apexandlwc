/**
 * Lightweight local state utility for LWC
 * Exposes: atom, setAtom, computed, defineState
 * Usage: import { defineState, atom, setAtom, computed } from 'c/sfState';
 */

// Atom is a simple wrapper over a value with a getter/setter pattern
export function atom(initialValue) {
    let _value = initialValue;
    const subscribers = new Set();

    return {
        get value() {
            return _value;
        },
        subscribe(callback) {
            subscribers.add(callback);
            return () => subscribers.delete(callback);
        },
        _notify(newValue) {
            for (const cb of subscribers) {
                try {
                    cb(newValue);
                } catch (e) {
                    // no-op for subscriber errors
                }
            }
        }
    };
}

// setAtom updates the atom value and notifies subscribers
export function setAtom(a, newValue) {
    if (!a) return;
    a._last = a.value;
    a._value = newValue;
    if (typeof a._notify === 'function') {
        a._notify(newValue);
    }
}

// computed creates a derived value from dependent atoms
export function computed(getterFn) {
    // Minimal implementation that evaluates lazily on access
    return {
        get value() {
            return getterFn();
        }
    };
}

/**
 * defineState provides a factory for a composed state manager.
 * The factoryFn receives the state helpers that can be used to create atoms and computeds.
 */
export function defineState(factoryFn) {
    if (typeof factoryFn !== 'function') {
        throw new Error('defineState requires a factory function');
    }
    return factoryFn({ atom, computed, setAtom });
}
