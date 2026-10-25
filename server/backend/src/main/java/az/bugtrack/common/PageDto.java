package az.bugtrack.common;

import java.util.List;

/** One page of a list: items, zero-based page number, page size and total number of rows. */
public record PageDto<T>(List<T> items, int page, int size, long total) {
}
