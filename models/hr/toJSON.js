// Shared JSON shape for HR models: expose `id` instead of `_id`, drop `__v`.
// `emp` references are sent as plain id strings.
export const hrToJSON = {
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        if (ret.emp) ret.emp = ret.emp.toString();
        return ret;
    }
};
