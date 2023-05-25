/* eslint-disable no-unused-vars */
import { BaseFilterConfig, FilterConfigType } from '@/shared/modules/filters/types/FilterConfig';

interface MultiSelectFilterOption {
  label: string;
  value: string;
}
export interface MultiSelectFilterOptionGroup {
  label?: string;
  options: MultiSelectFilterOption[];
}
export interface MultiSelectFilterOptions {
  options: MultiSelectFilterOptionGroup[]
}

export interface MultiSelectFilterValue {
  value: string[],
  include: boolean,
}

export interface MultiSelectFilterConfig extends BaseFilterConfig {
  type: FilterConfigType.MULTISELECT;
  options: MultiSelectFilterOptions;
  itemLabelRenderer: (value: MultiSelectFilterValue, options: MultiSelectFilterOptions) => string;
  apiFilterRenderer: (value: MultiSelectFilterValue) => any[];
}
