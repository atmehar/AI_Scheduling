from rest_framework.pagination import PageNumberPagination


class StandardResultsSetPagination(PageNumberPagination):
    """
    Standard pagination for API querysets.
    Default page size is 20, max limit is 100.
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
