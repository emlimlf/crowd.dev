import { attributesTypes } from '@/modules/organization/types/Attributes';
import OrganizationAttributesJSONRenderer from '@/modules/organization/components/organization-attributes-json-renderer.vue';
import { formatDate } from '@/utils/date';

export default {
  name: 'grossAdditionsByMonth',
  label: 'Gross Additions by Month',
  type: attributesTypes.json,
  showInForm: true,
  showInAttributes: true,
  component: OrganizationAttributesJSONRenderer,
  keyParser: (key) => formatDate({
    timestamp: key,
    format: 'MMMM YYYY',
  }),
};